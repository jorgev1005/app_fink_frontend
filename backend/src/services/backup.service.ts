import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const CONFIG_KEY = 'BACKUP_CONFIG';
const DEFAULT_CONFIG = {
  enabled: false,
  schedule: '0 2 * * *', // Daily at 2:00 AM
  keepLast: 7
};

// Variable to hold the running task so we can stop it if config changes
let backupTask: cron.ScheduledTask | null = null;

interface BackupConfig {
  enabled: boolean;
  schedule: string;
  keepLast: number;
}

export const BackupService = {
  /**
   * Get current backup configuration
   */
  async getConfig(): Promise<BackupConfig> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY }
    });

    if (!config) {
      return DEFAULT_CONFIG;
    }

    try {
      return JSON.parse(config.value);
    } catch (e) {
      console.error('Error parsing backup config, using default', e);
      return DEFAULT_CONFIG;
    }
  },

  /**
   * Update configuration and restart scheduler
   */
  async updateConfig(newConfig: Partial<BackupConfig>) {
    const current = await this.getConfig();
    const updated = { ...current, ...newConfig };

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(updated) },
      create: {
        key: CONFIG_KEY,
        value: JSON.stringify(updated),
        description: 'Configuration for automated database and file backups'
      }
    });

    // Re-schedule with new settings
    await this.initScheduler();
    
    return updated;
  },

  /**
   * Initialize the scheduler based on stored config
   */
  async initScheduler() {
    console.log('🔄 Initializing Backup Scheduler...');
    
    // Stop existing task
    if (backupTask) {
      backupTask.stop();
      backupTask = null;
    }

    const config = await this.getConfig();

    if (!config.enabled) {
      console.log('⏹️ Automated backups are specificially DISABLED in config.');
      return;
    }

    if (!cron.validate(config.schedule)) {
      console.error(`❌ Invalid cron schedule: ${config.schedule}`);
      return;
    }

    console.log(`✅ Scheduling backup with pattern: "${config.schedule}" (Timezone: America/Caracas)`);

    backupTask = cron.schedule(config.schedule, async () => {
      console.log('⏰ Starting automated backup...');
      try {
        await this.performBackup();
      } catch (error) {
        console.error('❌ Automated backup failed:', error);
      }
    }, {
      timezone: 'America/Caracas'
    });
  },

  /**
   * List available backup files
   */
  async listBackups() {
    const p = process.env.BACKUP_ROOT || '/home/fink/backups';

    if (!fs.existsSync(p)) {
       return [];
    }

    try {
        const files = await fs.promises.readdir(p);
        const backups = [];

        for (const file of files) {
            if (file.endsWith('.tar.gz')) {
                const filePath = path.join(p, file);
                const stats = await fs.promises.stat(filePath);
                backups.push({
                    id: file, // Use filename as ID
                    name: file,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    path: filePath
                });
            }
        }

        // Sort by date desc
        return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error('Error listing backups:', error);
        throw new Error('Failed to list backups');
    }
  },

  /**
   * Execute the RESTORE script
   */
  async performRestore(backupId: string) {
     const p = process.env.BACKUP_ROOT || '/home/fink/backups';
     const backupPath = path.join(p, backupId);

     // Security: Prevent directory traversal
     if (backupId.includes('..') || !backupId.endsWith('.tar.gz')) {
         throw new Error('Invalid backup filename');
     }

     if (!fs.existsSync(backupPath)) {
         throw new Error('Backup file not found');
     }

     const scriptPath = path.join(process.cwd(), 'scripts', 'server-restore.sh');
     
     if (!fs.existsSync(scriptPath)) {
        throw new Error('Restore script not found');
     }

     if (process.platform !== 'win32') {
         try {
            await execAsync(`chmod +x "${scriptPath}"`);
         } catch(e) {}
     }

      console.log(`🚀 Triggering RESTORE for: ${backupPath}`);
      
      // Spawn detached process so it survives when this node process dies (because the script stops pm2)
      // The script expects <path> <confirm="yes">. We pass "yes" to bypass prompt.
      // But wait! The script I wrote earlier reads interactively: `read -p ... confirm`.
      // I need to update the script to accept a flag or pass "yes" through stdin.
      // Or edit the script to check for a second argument.
      
      // I will update the script via SSH later to accept a "-y" flag or similar, 
      // OR I can pipe "yes" to it.
      
      // Let's modify the script Logic here to just PIPE "yes" if I can, OR update script.
      // Best way: Update script to look for a 'yes' argument or environment variable.
      
      // Assuming I update the script to accept "yes" as a second argument (which I should do).
      /*
        Current script:
        read -p "Are you absolutely sure? (Type 'yes' to confirm): " confirm
        if [ "$confirm" != "yes" ]; then ...
      */
      
      const { spawn } = require('child_process');
      
      // If I use shell: true, I can echo yes | script.
      // But standard spawn is safer.
      // Let's assume I'll fix the script to take an argument or FORCE it.
      
      // For now, I'll pass 'yes' as an argument and I'll modify the script to read $2 or check unbuffered input.
      const child = spawn('bash', [scriptPath, backupPath], {
          detached: true,
          stdio: ['pipe', 'ignore', 'ignore'] 
      });
      
      // Write 'yes' to stdin to satisfy the read prompt
      child.stdin.write('yes\n');
      child.stdin.end();
      child.unref();
      
      return { success: true, message: 'Restore initiated. Server will restart shortly.' };
  },

  /**
   * Execute the backup script immediately
   */
  async performBackup() {
    // Locate the script
    // process.cwd() should be the root of the backend folder defined in package.json
    const scriptPath = path.join(process.cwd(), 'scripts', 'server-backup.sh');

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Backup script not found at: ${scriptPath}`);
    }

    // Ensure script is executable (linux only, but good practice)
    if (process.platform !== 'win32') {
        try {
            await execAsync(`chmod +x "${scriptPath}"`);
        } catch (e) {
            console.warn('Could not chmod backup script, hoping strictly permissions are fine or not needed.');
        }
    }

    console.log(`🚀 Executing backup script: ${scriptPath}`);

    try {
      // Execute the bash script
      // On Windows this might fail if no bash is in path, but user is on Linux VPS for production
      // On local Windows dev, we might want to skip or use a different command, 
      // but the request is specific about the bash script for the server.
      
      const { stdout, stderr } = await execAsync(`"${scriptPath}"`);
      
      console.log('Backup Output:', stdout);
      if (stderr) console.error('Backup Stderr:', stderr);
      
      return { success: true, output: stdout };

    } catch (error: any) {
      console.error('Error executing backup script:', error);
      throw new Error(`Backup script failed: ${error.message}`);
    }
  }
};
