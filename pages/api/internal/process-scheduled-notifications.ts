import type { NextApiRequest, NextApiResponse } from "next";
import { processDueScheduledNotifications } from "@/server/scheduledNotifications";

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if(req.method!=="POST"&&req.method!=="GET") return res.status(405).end();
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.authorization!==`Bearer ${secret}`) return res.status(401).json({ok:false});
  const result=await processDueScheduledNotifications();
  res.status(200).json({ok:true,data:result});
}
