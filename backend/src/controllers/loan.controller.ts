import { Request, Response } from 'express';
import * as loanService from '../services/loan.service';

export const createLoan = async (req: Request, res: Response) => {
  try {
    const loanData = req.body;
    const loan = await loanService.createLoan(loanData, req.user!.id);
    res.status(201).json(loan);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error creating loan' });
  }
};

export const getLoans = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }
    const loans = await loanService.getLoansByProject(projectId as string);
    res.json(loans);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching loans' });
  }
};

export const getLoanById = async (req: Request, res: Response) => {
  try {
    const loan = await loanService.getLoanById(req.params.id);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }
    res.json(loan);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching loan' });
  }
};

export const deleteLoanEndpoint = async (req: Request, res: Response) => {
  try {
    await loanService.deleteLoan(req.params.id);
    res.json({ success: true, message: 'Préstamo y transacciones relacionadas anulados de forma exitosa' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error deleting loan' });
  }
};

export const addLoanPayment = async (req: Request, res: Response) => {
  try {
    const { loanId, totalAmount, principalAmount, interestAmount, bankAccountId, date } = req.body;
    // Si no mandan loanId en body lo sacamos de la ruta
    const id = loanId || req.params.id;

    const payment = await loanService.addLoanPayment({
      loanId: id,
      totalAmount,
      principalAmount,
      interestAmount,
      bankAccountId, // The account where the money exits
      date: date ? new Date(date) : new Date(),
      userId: req.user!.id
    });
    
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error adding loan payment' });
  }
};

export const addLoanCharge = async (req: Request, res: Response) => {
  try {
    const { amount, description, date } = req.body;
    const charge = await loanService.addLoanCharge({
      loanId: req.params.id,
      amount,
      description,
      date: date ? new Date(date) : new Date()
    });
    res.status(201).json(charge);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error adding loan charge' });
  }
};