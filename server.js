import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import {buildQuestion,LEVELS} from './questions.js';

for(const k of ['DATABASE_URL','CLASS_PASSWORD','ADMIN_PASSWORD','SESSION_SECRET'])if(!process.env[k]||process.env[k].startsWith('REEMPLAZA_'))throw Error(`Configura ${k} en .env o variables de entorno.`);
const year=Number(process.env.SCHOOL_YEAR)||new Date().getFullYear();
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:true}});
await db.query(`CREATE TABLE IF NOT EXISTS students (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS progress (student_id BIGINT REFERENCES students(id), year INT NOT NULL, points INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, correct_level INT NOT NULL DEFAULT 0, total_correct INT NOT NULL DEFAULT 0, total_attempts INT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY(student_id,year));
CREATE TABLE IF NOT EXISTS attempts (id BIGSERIAL PRIMARY KEY, student_id BIGINT REFERENCES students(id), year INT NOT NULL, level INT NOT NULL, correct BOOLEAN NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());`);
const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'8kb'}));app.use(cookieParser());
const limiter=rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:'draft-7',legacyHeaders:false});app.use('/api',limiter);
app.use(express.static('public',{extensions:['html']}));
const safeEq=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest());
const pinHash=(pin,salt)=>crypto.scryptSync(String(pin),salt,32).toString('hex');
const token=(role,id)=>{const value=Buffer.from(JSON.stringify({role,id,exp:Date.now()+7*86400e3})).toString('base64url');const mac=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(value).digest('base64url');return `${value}.${mac}`};
function auth(req){try{const [a,b]=String(req.cookies.jch_session||'').split('.');const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(a).digest('base64url');if(!safeEq(sig,b))return null;const t=JSON.parse(Buffer.from(a,'base64url').toString());return t.exp>Date.now()?t:null}catch{return null}}
function setCookie(res,role,id){res.cookie('jch_session',token(role,id),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:7*86400e3,path:'/'})}
function requireStudent(req,res,next){req.user=auth(req);if(req.user?.role!=='student')return res.status(401).json({error:'Inicia sesión como estudiante.'});next()}
function requireAdmin(req,res,next){req.user=auth(req);if(req.user?.role!=='admin')return res.status(403).json({error:'Acceso solo para el docente.'});next()}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ').slice(0,65)}
app.post('/api/login',async(req,res,next)=>{try{
 const {mode,password,pin}=req.body;if(mode==='admin'){if(!safeEq(password,process.env.ADMIN_PASSWORD))return res.status(401).json({error:'Clave de docente incorrecta.'});setCookie(res,'admin',0);return res.json({mode:'admin'})}
 if(mode!=='student'||!safeEq(password,process.env.CLASS_PASSWORD))return res.status(401).json({error:'Contraseña del juego incorrecta.'});
 const name=cleanName(req.body.name),nameKey=name.toLocaleLowerCase('es');if(name.length<3||!/^[\p{L}\p{M} .'-]+$/u.test(name))return res.status(400).json({error:'Escribe tu nombre completo (mínimo 3 letras).'});
 if(!/^\d{4,8}$/.test(String(pin||'')))return res.status(400).json({error:'El PIN debe contener de 4 a 8 números.'});
 let person=(await db.query('SELECT * FROM students WHERE name_key=$1',[nameKey])).rows[0];
 if(person){const [salt,stored]=person.pin_hash.split(':');if(!safeEq(pinHash(pin,salt),stored))return res.status(401).json({error:'Ese nombre ya existe. Comprueba tu PIN o consulta al docente.'});}
 else{const salt=crypto.randomBytes(16).toString('hex');try{person=(await db.query('INSERT INTO students(name,name_key,pin_hash) VALUES($1,$2,$3) RETURNING *',[name,nameKey,`${salt}:${pinHash(pin,salt)}`])).rows[0]}catch(e){if(e.code==='23505')return res.status(409).json({error:'Nombre registrado simultáneamente. Intenta ingresar otra vez.'});throw e}}
 await db.query('INSERT INTO progress(student_id,year) VALUES($1,$2) ON CONFLICT DO NOTHING',[person.id,year]);setCookie(res,'student',person.id);res.json({mode:'student',name:person.name});
}catch(e){next(e)}});
app.post('/api/logout',(req,res)=>{res.clearCookie('jch_session');res.json({ok:true})});
async function getProgress(id){let p=(await db.query('SELECT * FROM progress WHERE student_id=$1 AND year=$2',[id,year])).rows[0];if(!p){await db.query('INSERT INTO progress(student_id,year) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,year]);p=(await db.query('SELECT * FROM progress WHERE student_id=$1 AND year=$2',[id,year])).rows[0]}return p}
const questions=new Map();function nextQuestion(id,l){const q=buildQuestion(l);const key=crypto.randomUUID();questions.set(String(id),{key,q,level:l,time:Date.now(),used:false});return {key,title:q.title,unit:q.unit,bars:q.bars,prompt:q.prompt,options:q.options.map(o=>o.label)}}
app.get('/api/me',async(req,res,next)=>{try{const u=auth(req);if(!u)return res.json({loggedIn:false,year});if(u.role==='admin')return res.json({loggedIn:true,mode:'admin',year});const s=(await db.query('SELECT name FROM students WHERE id=$1',[u.id])).rows[0];if(!s)return res.json({loggedIn:false,year});res.json({loggedIn:true,mode:'student',name:s.name,year,progress:await getProgress(u.id),levels:LEVELS})}catch(e){next(e)}});
app.get('/api/question',requireStudent,async(req,res,next)=>{try{const p=await getProgress(req.user.id);res.json({question:nextQuestion(req.user.id,p.level),progress:p})}catch(e){next(e)}});
app.post('/api/answer',requireStudent,async(req,res,next)=>{const id=req.user.id,active=questions.get(String(id));if(!active||active.used||active.key!==req.body.key||Date.now()-active.time>60*60*1000)return res.status(409).json({error:'Este ejercicio ya no está disponible. Solicita otro.'});active.used=true;const selected=Number(req.body.option);if(!Number.isInteger(selected)||selected<0||selected>=active.q.options.length)return res.status(400).json({error:'Opción inválida.'});const correct=active.q.options[selected].value===active.q.answer;const client=await db.connect();try{await client.query('BEGIN');const p=(await client.query('SELECT * FROM progress WHERE student_id=$1 AND year=$2 FOR UPDATE',[id,year])).rows[0];if(!p||p.level!==active.level){await client.query('ROLLBACK');return res.status(409).json({error:'Tu nivel cambió. Recarga el ejercicio.'})}let nextLevel=p.level,correctLevel=Math.min(20,p.correct_level+(correct?1:0)),advance=false;if(correctLevel>=20&&nextLevel<5){nextLevel++;correctLevel=0;advance=true}await client.query('UPDATE progress SET points=points+$1,level=$2,correct_level=$3,total_correct=total_correct+$4,total_attempts=total_attempts+1,updated_at=NOW() WHERE student_id=$5 AND year=$6',[correct?10:0,nextLevel,correctLevel,correct?1:0,id,year]);await client.query('INSERT INTO attempts(student_id,year,level,correct) VALUES($1,$2,$3,$4)',[id,year,active.level,correct]);await client.query('COMMIT');res.json({correct,explanation:active.q.explanation,answer:String(active.q.answer),advanced:advance,progress:await getProgress(id)})}catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}});
app.get('/api/admin/results',requireAdmin,async(req,res,next)=>{try{const requested=Number(req.query.year)||year;const students=(await db.query(`SELECT s.id,s.name,p.year,p.points,p.level,p.correct_level,p.total_correct,p.total_attempts,p.updated_at FROM progress p JOIN students s ON s.id=p.student_id WHERE p.year=$1 ORDER BY p.points DESC,s.name`,[requested])).rows;const years=(await db.query('SELECT DISTINCT year FROM progress ORDER BY year DESC')).rows.map(x=>x.year);res.json({year:requested,currentYear:year,years,students})}catch(e){next(e)}});
app.get('/api/admin/export',requireAdmin,async(req,res,next)=>{try{const y=Number(req.query.year)||year;const rows=(await db.query('SELECT s.name,p.* FROM progress p JOIN students s ON s.id=p.student_id WHERE p.year=$1 ORDER BY p.points DESC',[y])).rows;const escape=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const csv=[['Nombre','Gestión','Puntos','Nivel','Aciertos del nivel','Aciertos totales','Intentos','Actualización'],...rows.map(r=>[r.name,r.year,r.points,r.level,r.correct_level,r.total_correct,r.total_attempts,r.updated_at.toISOString()])].map(r=>r.map(escape).join(',')).join('\r\n');res.type('text/csv; charset=utf-8').set('Content-Disposition',`attachment; filename="JCH-resultados-${y}.csv"`).send('\uFEFF'+csv)}catch(e){next(e)}});
app.get('/api/health',(_,res)=>res.json({ok:true}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Ocurrió un error del servidor. Inténtalo nuevamente.'})});
app.listen(process.env.PORT||3000,()=>console.log(`JCH activo en puerto ${process.env.PORT||3000}, gestión ${year}`));
