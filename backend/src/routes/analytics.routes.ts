import { Router } from 'express'
import { receiveEvent } from '../controllers/analytics.controller'

const router = Router()

router.post('/', receiveEvent)

export default router
