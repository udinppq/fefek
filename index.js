const { Telegraf } = require("telegraf")
const axios = require("axios")
const fs = require("fs")
const bot = new Telegraf("8561436521:AAH89FkWExnvo72K0V7yYDPNBO6NWj3Bdcs")
let premium = fs.existsSync("./premium.json") ? JSON.parse(fs.readFileSync("./premium.json")) : []
let users = fs.existsSync("./users.json") ? JSON.parse(fs.readFileSync("./users.json")) : {}
let blocked = fs.existsSync("./block.json") ? JSON.parse(fs.readFileSync("./block.json")) : []
const OWNER = 8499796475
const save=_=>{
  fs.writeFileSync("./premium.json",JSON.stringify(premium))
  fs.writeFileSync("./users.json",JSON.stringify(users))
}
const formatNumber=n=>{
  if(n===null||n===undefined) return "0"
  return Number(n).toLocaleString("en-US")
}
const isDomain=t=>/^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(t)
const clean=d=>d.replace(/^https?:\/\//,"").trim()
const extract=t=>t.split(/\s+/).filter(isDomain)
const check=async d=>{
  try{
    const {data}=await axios.get("https://www.linkbuildinghq.com/wp-admin/admin-ajax.php",{params:{action:"get_moz_ahref_metrics",target_url:d}})
    const x=data.data
    return `╭─〔 🌐 DOMAIN ANALYZER 〕
│ 🔗 ${d}
│
│ 📊 Authority
│  ├ DA : ${x.da}
│  ├ PA : ${x.pa}
│  └ DR : ${x.dr}
│
│ ⚠️ Spam
│  └ Spam Score : ${x.spam_score}%
│
│ 📡 Traffic
│  └ Organic Traffic : ${formatNumber(x.org_traffic)}
╰────────────`
  }catch{
    return `❌ ${d} gagal`
  }
}
const isBlocked=id=>blocked.includes(id)
const blockUser=id=>{
  if(!blocked.includes(id)){
    blocked.push(id)
    fs.writeFileSync("./block.json",JSON.stringify(blocked))
  }
}
const unblockUser=id=>{
  blocked=blocked.filter(v=>v!=id)
  fs.writeFileSync("./block.json",JSON.stringify(blocked))
}
const isPrem=id=>{
  if(id==OWNER)return true
  const u=premium.find(v=>v.id==id)
  if(!u)return false
  if(Date.now()>u.expired){
    premium=premium.filter(v=>v.id!=id)
    save()
    return false
  }
  return true
}
const addPrem=(id,t)=>{
  const exp=Date.now()+t
  const u=premium.find(v=>v.id==id)
  u?u.expired=exp:premium.push({id,expired:exp})
  save()
}
const delPrem=id=>{
  premium=premium.filter(v=>v.id!=id)
  save()
}
const parseTime=t=>{
  const n=parseInt(t)
  return t.endsWith("h")?n*36e5:t.endsWith("d")?n*864e5:t.endsWith("m")?n*2592e6:0
}
const getUser=id=>{
  if(!users[id])users[id]={limit:3,last:Date.now(),ref:null}
  if(Date.now()-users[id].last>864e5){
    users[id].limit=3
    users[id].last=Date.now()
  }
  return users[id]
}
const use=(id,c=1)=>{
  if(isPrem(id))return true
  const u=getUser(id)
  if(u.limit<c)return false
  u.limit-=c
  save()
  return true
}
bot.start(ctx=>{
  const id=ctx.from.id
  const arg=ctx.message.text.split(" ")[1]
  const u=getUser(id)
  if(arg&&!u.ref&&arg!=id){
    if(!users[arg]) users[arg]=getUser(arg)
    users[arg].limit+=3
    u.ref=arg
    save()
  }
  ctx.reply(`╭─〔 🤖 SEO BOT 〕
│ 🚀 Kirim domain untuk mengecek
│ 📦 Support bulk cheker
│ 🎁 1 Referral = +3 limit
│
│ /start >> mulai bot
│ /limit >> cek limit
│
│ 🔗 Referral kamu:
│ \`https://t.me/${ctx.me}?start=${id}\`
╰────────────`, {parse_mode:"Markdown"})
})
bot.use((ctx,next)=>{
  if(ctx.from && isBlocked(ctx.from.id)){
    return ctx.reply("❌ Kamu diblokir oleh owner")
  }
  return next()
})
bot.command("addprem",ctx=>{
  if(ctx.from.id!==OWNER)return ctx.reply("❌ Owner Only")
  const args=ctx.message.text.split(" ")
  if(args.length<3) return ctx.reply("Format: /addprem id 1d")
  const id=args[1]
  const ms=parseTime(args[2])
  if(!ms) return ctx.reply("Format waktu salah (h/d/m)")
  addPrem(id,ms)
  ctx.reply("✅ Premium aktif")
})
bot.command("delprem",ctx=>{
  if(ctx.from.id!==OWNER)return ctx.reply("❌ Owner Only")
  const args=ctx.message.text.split(" ")
  if(args.length<2) return ctx.reply("Format: /delprem  id")
  delPrem(ctx.message.text.split(" ")[1])
  ctx.reply("✅ Premium dihapus")
})
bot.command("limit",ctx=>{
  const id=ctx.from.id
  const u=getUser(id)
  const status=isPrem(id) ? "PREMIUM" : "FREE"
  const lim=isPrem(id) ? "UNLIMITED" : u.limit
  ctx.reply(`╭─〔 📊 LIMIT INFO 〕
│ 👤 ID : ${id}
│ 🏷 Status : ${status}
│
│ 🎯 Sisa Limit :
│ ${lim}
│
╰────────────`)
})
bot.on("text",async ctx=>{
  const id=ctx.from.id
  const list=extract(ctx.message.text)
  if(!list.length)return
  if(!use(id,list.length))return ctx.reply(`❌ Limit kurang (${list.length} dibutuhkan)`)
  const msg=await ctx.reply("⏳ Mengecek domain...")
  if(list.length===1){
    const res=await check(clean(list[0]))
    return ctx.telegram.editMessageText(ctx.chat.id,msg.message_id,null,res)
  }
  let out=`╭─〔 📦 BULK CHECKER 〕\n`
  for(let d of list){
    const r=await check(clean(d))
    out+=`│\n│ ${r.replace(/\n/g,"\n│ ")}\n`
  }
  ctx.telegram.editMessageText(ctx.chat.id,msg.message_id,null,out+"╰────────────")
})
bot.command("block",ctx=>{
  if(ctx.from.id!==OWNER)return ctx.reply("❌ Owner Only")
  const id=ctx.message.text.split(" ")[1]
  if(!id) return ctx.reply("Format: /block id")
  blockUser(id)
  ctx.reply("✅ User diblokir")
})
bot.command("unblock",ctx=>{
  if(ctx.from.id!==OWNER)return ctx.reply("❌ Owner Only")
  const id=ctx.message.text.split(" ")[1]
  if(!id) return ctx.reply("Format: /unblock id")
  unblockUser(id)
  ctx.reply("✅ User dibuka")
})
bot.launch()
