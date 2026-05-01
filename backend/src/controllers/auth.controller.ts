import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Registro de usuario
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { message: 'El email ya está registrado' }
      });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'USER'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    // Generar token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: { user, token }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { message: 'Credenciales inválidas o usuario inactivo' }
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: { message: 'Credenciales inválidas' }
      });
    }

    // Generar token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    // Registrar actividad (incluye IP y user-agent)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'VIEW',
        entity: 'Auth',
        entityId: user.id,
        description: 'Usuario inició sesión',
        ipAddress: (req as any).ip || (req.headers['x-forwarded-for'] as string) || '',
        userAgent: (req.headers['user-agent'] as string) || ''
      }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar
        },
        token
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

// Obtener perfil
export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

// Actualizar perfil
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(avatar && { avatar })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true
      }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

// Login con Google
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, error: { message: 'Token de Google requerido' } });
    }
    
    // Verificar token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ success: false, error: { message: 'Token inválido' } });
    }

    const { email, given_name, family_name, picture } = payload;

    // Buscar si el usuario ya existe
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Registrar nuevo usuario
      const randomPassword = Math.random().toString(36).slice(-8); 
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = await prisma.user.create({
        data: {
          email,
          firstName: given_name || 'Usuario',
          lastName: family_name || 'Google',
          password: hashedPassword,
          avatar: picture,
          role: 'USER', 
          isActive: true
        }
      });
    } else {
        // Actualizar avatar si viene de Google
        if (picture && !user.avatar) {
            await prisma.user.update({
                where: { id: user.id },
                data: { avatar: picture }
            });
            user.avatar = picture;
        }
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, error: { message: 'Usuario inactivo' } });
    }

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    // Registrar actividad
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'Auth',
        entityId: user.id,
        description: 'Inicio de sesión con Google',
        ipAddress: (req as any).ip || (req.headers['x-forwarded-for'] as string) || '',
        userAgent: (req.headers['user-agent'] as string) || ''
      }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar
        },
        token
      }
    });

  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Google Auth Error:', error);
    res.status(401).json({ success: false, error: { message: 'Error autenticando con Google' } });
  }
};
