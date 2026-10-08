import type { NextApiRequest,NextApiResponse } from "next";
export default function handler(req:NextApiRequest,res:NextApiResponse){const payment=Array.isArray(req.query.payment)?req.query.payment[0]:req.query.payment;res.redirect(`mobsieconnect://payment/return?payment=${encodeURIComponent(payment||'')}`);}
