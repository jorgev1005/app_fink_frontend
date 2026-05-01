import { Request, Response } from 'express';
import prisma from '../config/database';

interface ForexImpactSource {
  source: string;
  sourceDateToday: Date;
  sourceDateYesterday: Date;
  rateToday: number;
  rateYesterday: number;
  rateTodayEUR: number;
  rateYesterdayEUR: number;
  valueYesterdayUSD: number;
  valueTodayUSD: number;
  valueYesterdayEUR: number;
  valueTodayEUR: number;
  lossUSD: number;
  lossBS: number; // Impacto en Bs (que faltan/sobran)
  lossEUR: number;
  devaluationPercentage: number;
  devaluationPercentageEUR: number;
  _debug?: any;
}

export const getForexImpact = async (req: Request, res: Response) => {
  try {
    const projectIdQuery = req.query.projectId as string | undefined;

    // 1. Get Accounts with positive Bolivar balance
    // Ensure we only look at accounts belonging to the user's projects if needed, 
    // but typically forex risk is global per company/project.
    // For now, let's filter by the user's accessible projects.
    
    // Find projects for this user
    const whereCondition: any = {
      users: { some: { userId: req.user!.id } },
      status: 'ACTIVE'
    };

    if (projectIdQuery) {
      whereCondition.id = projectIdQuery;
    }

    const userProjects = await prisma.project.findMany({
      where: whereCondition,
      include: {
        accounts: {
          where: {
            currency: 'BS',
            balanceBs: { gt: 0 },
            isActive: true,
            type: 'ASSET' // Solo cuentas de tipo Activo (Bancos/Cajas)
          }
        }
      }
    });

    let totalBs = 0;
    const accountsDetail: any[] = [];

    userProjects.forEach(project => {
      project.accounts.forEach(acc => {
        totalBs += acc.balanceBs;
        accountsDetail.push({
          id: acc.id,
          name: acc.name,
          balanceBs: acc.balanceBs,
          projectId: project.id,
          projectName: project.name
        });
      });
    });
    
    // Even if totalBs is 0, we still want to return the rates (sources) if possible, 
    // but the calculation makes no sense without balance. 
    // However, the user wants "To be able to select any of the 4 types".
    // If balance is 0, impact is 0. That's fine. We shouldn't return empty early if we want to show rates.
    // But the widget hides if totalBs <= 0 in my current frontend logic (which i disabled for debug).
    
    // Let's allow returning sources even with 0 balance, so user sees "0 loss".

    // 2. Get Exchange Rates (Distinct Sources)
    // We'll check standard ones first: BCV, BINANCE, CUSTOM, PARALELO
    const knownSources = ['BCV', 'BINANCE', 'CUSTOM', 'PARALELO'];
    const impactBySource: Partial<ForexImpactSource>[] = [];
    
    // Parse custom date range if provided
    const startDateQuery = req.query.startDate as string;
    const endDateQuery = req.query.endDate as string;
    
    let useDateRange = false;
    let targetStartDate: Date | null = null;
    let targetEndDate: Date | null = null;

    if (startDateQuery && endDateQuery) {
        useDateRange = true;
        targetStartDate = new Date(startDateQuery);
        targetEndDate = new Date(endDateQuery);
        
        // Ensure valid dates
        if (isNaN(targetStartDate.getTime()) || isNaN(targetEndDate.getTime())) {
             useDateRange = false;
        }
    }

    for (const source of knownSources) {
      let today: any = null;
      let yesterday: any = null;
      
      // FIX: Handle BINANCE stored as 'API' in DB
      const searchSource = source === 'BINANCE' ? ['BINANCE', 'API'] : [source];

      if (useDateRange && targetStartDate && targetEndDate) {
          // Find rate for End Date (Current, "Today")
          today = await prisma.exchangeRate.findFirst({
              where: { 
                  source: { in: searchSource },
                  date: { lte: targetEndDate }
              },
              orderBy: { date: 'desc' }
          });

          // Find rate for Start Date (Baseline, "Yesterday")
          yesterday = await prisma.exchangeRate.findFirst({
              where: { 
                  source: { in: searchSource },
                  date: { lte: targetStartDate }
              },
              orderBy: { date: 'desc' }
          });

      } else {
          // Default behavior (24h mode): Get the latest rate
          today = await prisma.exchangeRate.findFirst({
              where: { source: { in: searchSource } },
              orderBy: { date: 'desc' }
          });

          if (today) {
              // Find the FIRST rate in the past that has a different value to show the actual last movement
              yesterday = await prisma.exchangeRate.findFirst({
                  where: {
                      source: { in: searchSource },
                      date: { lt: today.date },
                      OR: [
                          { usdToBs: { not: today.usdToBs } },
                          { eurToBs: { not: today.eurToBs } }
                      ]
                  },
                  orderBy: { date: 'desc' }
              });

              if (!yesterday) {
                  yesterday = today; // No history of different rates exists
              }
          }
      }

      let rateToday = today ? today.usdToBs : 0;
      let rateYesterday = yesterday ? yesterday.usdToBs : 0;
      let rateTodayEUR = today ? today.eurToBs : 0;
      let rateYesterdayEUR = yesterday ? yesterday.eurToBs : 0;

      // Avoid division by zero
      let valueTodayUSD = rateToday > 0 ? totalBs / rateToday : 0;
      let valueYesterdayUSD = rateYesterday > 0 ? totalBs / rateYesterday : 0;
      
      let valueTodayEUR = rateTodayEUR > 0 ? totalBs / rateTodayEUR : 0;
      let valueYesterdayEUR = rateYesterdayEUR > 0 ? totalBs / rateYesterdayEUR : 0;

      let devaluationPercentage = 0;
      if (rateYesterday > 0) {
          devaluationPercentage = ((rateToday - rateYesterday) / rateYesterday) * 100;
      }
      
      let devaluationPercentageEUR = 0;
      if (rateYesterdayEUR > 0) {
          devaluationPercentageEUR = ((rateTodayEUR - rateYesterdayEUR) / rateYesterdayEUR) * 100;
      }

      impactBySource.push({
          source,
          sourceDateToday: today ? today.date : new Date(),
          sourceDateYesterday: yesterday ? yesterday.date : new Date(),
          rateToday,
          rateYesterday,
          rateTodayEUR,
          rateYesterdayEUR,
          valueYesterdayUSD,
          valueTodayUSD,
          valueYesterdayEUR,
          valueTodayEUR,
          lossUSD: valueYesterdayUSD - valueTodayUSD,
          lossBS: (valueYesterdayUSD - valueTodayUSD) * rateToday, 
          lossEUR: valueYesterdayEUR - valueTodayEUR,
          devaluationPercentage,
          devaluationPercentageEUR
      });
    }

    res.json({
      success: true,
      data: {
        totalBs,
        impactBySource,
        accounts: accountsDetail
      }
    });
  } catch (error) {
    console.error('Error fetching forex impact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching forex impact' 
    });
  }
};
