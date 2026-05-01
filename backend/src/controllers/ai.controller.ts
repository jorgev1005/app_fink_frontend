import { Request, Response } from 'express';
import prisma from '../config/database';
import { analyzeDocumentWithAI, generateExecutiveReport } from '../services/ai.service';

export const getInsights = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;

    const where: any = {
      isRead: false,
      validUntil: {
        gte: new Date()
      }
    };

    if (projectId) {
      where.projectId = projectId;
    }

    const insights = await prisma.aIInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      data: insights
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const analyzeDocument = async (req: Request, res: Response) => {
  try {
    const { documentText, documentType } = req.body;

    if (!documentText) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requiere el texto del documento' }
      });
    }

    const analysis = await analyzeDocumentWithAI(documentText, documentType || 'INVOICE');

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate } = req.body;

    if (!projectId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requieren projectId, startDate y endDate' }
      });
    }

    const report = await generateExecutiveReport(
      projectId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      data: { report }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
