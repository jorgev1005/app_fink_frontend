import { Request, Response } from 'express';
import { BackupService } from '../services/backup.service';

export const getBackupConfig = async (req: Request, res: Response) => {
  try {
    const config = await BackupService.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching backup config:', error);
    res.status(500).json({ message: 'Error fetching backup configuration' });
  }
};

export const updateBackupConfig = async (req: Request, res: Response) => {
  try {
    const { enabled, schedule, keepLast } = req.body;
    
    // Basic validation
    if (schedule && typeof schedule !== 'string') {
        return res.status(400).json({ message: 'Invalid schedule format' });
    }

    const updated = await BackupService.updateConfig({
      enabled, 
      schedule, 
      keepLast
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating backup config:', error);
    res.status(500).json({ message: 'Error updating backup configuration' });
  }
};

export const getBackupsList = async (req: Request, res: Response) => {
    try {
        const backups = await BackupService.listBackups();
        res.json(backups);
    } catch (error) {
        res.status(500).json({ message: 'Error listing backups' });
    }
};

export const restoreBackup = async (req: Request, res: Response) => {
    try {
        const { id } = req.body; // Filename
        if (!id) return res.status(400).json({ message: 'Backup ID required' });
        
        const result = await BackupService.performRestore(id);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const triggerManualBackup = async (req: Request, res: Response) => {
  try {
    // Run in background if desired, or await.
    // For manual triggers, usually user wants to see result, but it might timeout if large.
    // Given the script is efficient, we try to await it. 
    
    const result = await BackupService.performBackup();
    res.json({ message: 'Backup executed successfully', output: result.output });
  } catch (error: any) {
    console.error('Error performing manual backup:', error);
    res.status(500).json({ message: 'Backup failed', error: error.message });
  }
};
