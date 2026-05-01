import { Request, Response } from 'express'
import prisma from '../config/database'

export const receiveEvent = async (req: Request, res: Response) => {
  try {
    const { event, props } = req.body
    const ip = req.ip || req.headers['x-forwarded-for'] as string | undefined
    const record = await prisma.analyticsEvent.create({
      data: {
        event: event || 'unknown',
        props: props ? JSON.stringify(props) : null,
        ip: ip || undefined,
      }
    })
    console.log('📈 Analytics event stored:', record.id, record.event)
    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('Error receiving analytics event', error)
    res.status(500).json({ ok: false, error: 'internal' })
  }
}
