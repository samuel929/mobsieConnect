import type { NextApiRequest,NextApiResponse } from "next";
import { query } from "@/server/db";
export default async function handler(req:NextApiRequest,res:NextApiResponse){const payment=Array.isArray(req.query.payment)?req.query.payment[0]:req.query.payment;if(payment)await query("UPDATE application_payments SET status='CANCELLED',updated_at=now() WHERE id=$1 AND status<>'COMPLETE'",[payment]);res.redirect(`mobsieconnect://payment/cancel?payment=${encodeURIComponent(payment||'')}`);}
