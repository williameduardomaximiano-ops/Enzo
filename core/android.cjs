const http=require('node:http');const crypto=require('node:crypto');const fs=require('node:fs');const os=require('node:os');
function equal(a,b){return typeof a==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
class Companion{
 constructor(file,requestPair,command,status){Object.assign(this,{file,requestPair,command,status});this.server=null;this.clients=new Map();this.attempts=new Map();}
 async start(){if(this.server)return this.info;this.code=String(crypto.randomInt(100000,1000000));this.expiry=Date.now()+120000;
 const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
 const reply=(s,x)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(x));};
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'Origem bloqueada'});
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(this.file));}
 try{
 let body='';for await(const c of req){body+=c;if(body.length>12000)return reply(413,{error:'Requisição excede o limite'});}
 if(req.url==='/pair'&&req.method==='POST'){
 const ip=req.socket.remoteAddress;const now=Date.now();let attempt=this.attempts.get(ip)||{n:0,at:now};if(now-attempt.at>120000)attempt={n:0,at:now};attempt.n++;this.attempts.set(ip,attempt);if(attempt.n>5)return reply(429,{error:'Muitas tentativas. Aguarde dois minutos.'});
 const data=JSON.parse(body);if(now>this.expiry||!equal(data.code,this.code))return reply(403,{error:'Código inválido ou expirado.'});
 this.code='';const approved=await this.requestPair(ip);if(!approved)return reply(403,{error:'Conexão recusada no PC.'});
 const token=crypto.randomBytes(32).toString('hex');this.clients.set(token,{expires:now+3600000,last:0});return reply(200,{token});
 }
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');const client=this.clients.get(token);if(!client||client.expires<Date.now())return reply(401,{error:'Faça o pareamento novamente.'});
 if(req.url==='/status'&&req.method==='GET')return reply(200,this.status());
 if(req.url==='/command'&&req.method==='POST'){if(Date.now()-client.last<2000)return reply(429,{error:'Aguarde antes de enviar novamente.'});client.last=Date.now();const d=JSON.parse(body);return reply(200,await this.command(d.text));}
 reply(404,{error:'Não encontrado'});
 }catch(e){reply(400,{error:e.message});}
 });this.server=server;server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'0.0.0.0',resolve)});
 let ips=[];try{ips=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address)}catch{}
 this.info={port:server.address().port,code:this.code,urls:ips.map(ip=>`http://${ip}:${server.address().port}`),expires:this.expiry};return this.info;
 }
 stop(){this.clients.clear();if(this.server){this.server.closeAllConnections();this.server.close();}this.server=null;this.info=null;}
}
module.exports={Companion,equal};
