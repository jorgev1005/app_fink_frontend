import { Request, Response } from 'express';
import { generateCFOSummary, generateDetailedCFOReport } from '../services/cfo.service';

export const getCFOSummary = async (req: Request, res: Response) => {
  try {
    let { projectId } = req.query;
    // Optional projectId
    if (projectId === 'undefined' || projectId === 'null') {
      projectId = undefined;
    }
    
    const summary = await generateCFOSummary(projectId as string | undefined);
    return res.json({ success: true, data: { summary } });
  } catch (error: any) {
    console.error('CFO Summary Error:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getDetailedCFOReport = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    // Optional projectId
    
    const report = await generateDetailedCFOReport(projectId as string);
    return res.json({ success: true, data: { report } });
  } catch (error: any) {
    console.error('CFO Report Error:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

