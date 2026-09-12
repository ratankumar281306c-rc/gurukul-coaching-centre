const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "gurukul-dev-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Gurukul@123";

const db = new Database(path.join(__dirname, "gurukul.db"));
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 phone TEXT,
 password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 description TEXT,
 price INTEGER DEFAULT 0,
 image TEXT,
 active INTEGER DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enrollments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 course_id INTEGER NOT NULL,
 payment_status TEXT DEFAULT 'pending',
 enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,course_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lessons(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 video_url TEXT,
 notes_url TEXT,
 sort_order INTEGER DEFAULT 0,
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tests(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER,
 title TEXT NOT NULL,
 duration_minutes INTEGER DEFAULT 30,
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS questions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 test_id INTEGER NOT NULL,
 question TEXT NOT NULL,
 option_a TEXT NOT NULL,
 option_b TEXT NOT NULL,
 option_c TEXT NOT NULL,
 option_d TEXT NOT NULL,
 correct TEXT NOT NULL,
 FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS results(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 test_id INTEGER NOT NULL,
 score INTEGER NOT NULL,
 total INTEGER NOT NULL,
 submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notices(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leads(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT,
 course TEXT,
 message TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function seed() {
  const admin = db.prepare("SELECT id FROM users WHERE email=?").get("admin@gurukul.local");
  if (!admin) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)")
      .run("Gurukul Admin","admin@gurukul.local",hash,"admin");
  }
  if (db.prepare("SELECT COUNT(*) c FROM courses").get().c === 0) {
    const add = db.prepare("INSERT INTO courses(title,category,description,price,image) VALUES(?,?,?,?,?)");
    const a = add.run("JEE Lakshya Batch","JEE","Complete JEE preparation with Physics, Chemistry and Mathematics.",4999,"");
    const b = add.run("NEET Target Batch","NEET","Concepts, practice, tests and revision for NEET.",4999,"");
    const c = add.run("Foundation Class 9–10","Foundation","Strong school + competitive foundation for Classes 9 and 10.",2999,"");
    const lesson = db.prepare("INSERT INTO lessons(course_id,title,video_url,notes_url,sort_order) VALUES(?,?,?,?,?)");
    lesson.run(a.lastInsertRowid,"Welcome & Study Plan","https://www.youtube.com/embed/dQw4w9WgXcQ","https://example.com/notes/jee.pdf",1);
    lesson.run(a.lastInsertRowid,"Physics: Units & Dimensions","https://www.youtube.com/embed/dQw4w9WgXcQ","https://example.com/notes/units.pdf",2);
    lesson.run(b.lastInsertRowid,"NEET Biology Orientation","https://www.youtube.com/embed/dQw4w9WgXcQ","https://example.com/notes/biology.pdf",1);
    lesson.run(c.lastInsertRowid,"Foundation Mathematics Basics","https://www.youtube.com/embed/dQw4wWgXcQ","https://example.com/notes/math.pdf",1);
    const t = db.prepare("INSERT INTO tests(course_id,title,duration_minutes) VALUES(?,?,?)");
    const tid = t.run(a.lastInsertRowid,"JEE Demo Test",20).lastInsertRowid;
    db.prepare("INSERT INTO questions(test_id,question,option_a,option_b,option_c,option_d,correct) VALUES(?,?,?,?,?,?,?)")
      .run(tid,"What is the SI unit of force?","Joule","Newton","Watt","Pascal","B");
    db.prepare("INSERT INTO questions(test_id,question,option_a,option_b,option_c,option_d,correct) VALUES(?,?,?,?,?,?,?)")
      .run(tid,"2 + 2 × 3 = ?","12","10","8","6","D");
    db.prepare("INSERT INTO notices(title,body) VALUES(?,?)")
      .run("Admissions Open","JEE, NEET and Foundation batches are now open. Contact us for counselling.");
  }
}
seed();

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "gurukul-coaching-centre" });
});

function tokenFor(u){ return jwt.sign({id:u.id,role:u.role,name:u.name,email:u.email},JWT_SECRET,{expiresIn:"7d"}); }
function auth(req,res,next){
  try{
    const h=req.headers.authorization||"";
    if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Login required"});
    req.user=jwt.verify(h.slice(7),JWT_SECRET); next();
  }catch(e){ return res.status(401).json({error:"Invalid or expired session"}); }
}
function admin(req,res,next){ auth(req,res,()=>req.user.role==="admin"?next():res.status(403).json({error:"Admin only"})); }

app.post("/api/auth/register",(req,res)=>{
  const {name,email,phone,password}=req.body||{};
  if(!name||!email||!password) return res.status(400).json({error:"Name, email and password are required"});
  try{
    const hash=bcrypt.hashSync(password,10);
    const info=db.prepare("INSERT INTO users(name,email,phone,password,role) VALUES(?,?,?,?,?)").run(name,email.toLowerCase(),phone||"",hash,"student");
    const u=db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(info.lastInsertRowid);
    res.json({token:tokenFor(u),user:u});
  }catch(e){ res.status(400).json({error:"Email already registered"}); }
});
app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.prepare("SELECT * FROM users WHERE email=?").get((email||"").toLowerCase());
  if(!u||!bcrypt.compareSync(password||"",u.password)) return res.status(401).json({error:"Invalid email or password"});
  res.json({token:tokenFor(u),user:{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role}});
});
app.get("/api/me",auth,(req,res)=>{
  res.json(db.prepare("SELECT id,name,email,phone,role,created_at FROM users WHERE id=?").get(req.user.id));
});

app.get("/api/courses",(req,res)=>res.json(db.prepare("SELECT * FROM courses WHERE active=1 ORDER BY id DESC").all()));
app.get("/api/courses/:id",(req,res)=>{
  const c=db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);
  if(!c) return res.status(404).json({error:"Course not found"});
  res.json({...c,lessons:db.prepare("SELECT id,title,video_url,notes_url,sort_order FROM lessons WHERE course_id=? ORDER BY sort_order,id").all(c.id),
    tests:db.prepare("SELECT id,title,duration_minutes FROM tests WHERE course_id=?").all(c.id)});
});

app.post("/api/leads",(req,res)=>{
  const {name,phone,email,course,message}=req.body||{};
  if(!name||!phone) return res.status(400).json({error:"Name and phone are required"});
  db.prepare("INSERT INTO leads(name,phone,email,course,message) VALUES(?,?,?,?,?)").run(name,phone,email||"",course||"",message||"");
  res.json({ok:true,message:"Enquiry submitted"});
});

app.get("/api/notices",(req,res)=>res.json(db.prepare("SELECT * FROM notices ORDER BY id DESC").all()));

app.post("/api/enroll/:courseId",auth,(req,res)=>{
  const c=db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.courseId);
  if(!c) return res.status(404).json({error:"Course not found"});
  db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course_id,payment_status) VALUES(?,?,?)").run(req.user.id,c.id,c.price===0?"paid":"pending");
  res.json({ok:true,payment_status:c.price===0?"paid":"pending",message:c.price===0?"Enrolled successfully":"Enrollment created. Complete payment in your live payment setup."});
});

app.get("/api/student/dashboard",auth,(req,res)=>{
  const courses=db.prepare(`SELECT c.*,e.payment_status,e.enrolled_at FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.id DESC`).all(req.user.id);
  const results=db.prepare(`SELECT r.*,t.title FROM results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=? ORDER BY r.id DESC`).all(req.user.id);
  res.json({courses,results});
});
app.get("/api/student/course/:id",auth,(req,res)=>{
  const ok=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND (payment_status='paid' OR (SELECT price FROM courses WHERE id=course_id)=0)").get(req.user.id,req.params.id);
  if(!ok) return res.status(403).json({error:"Enroll in this course first"});
  const c=db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);
  c.lessons=db.prepare("SELECT * FROM lessons WHERE course_id=? ORDER BY sort_order,id").all(c.id);
  c.tests=db.prepare("SELECT id,title,duration_minutes FROM tests WHERE course_id=?").all(c.id);
  res.json(c);
});

app.get("/api/tests/:id",auth,(req,res)=>{
  const t=db.prepare("SELECT id,title,duration_minutes,course_id FROM tests WHERE id=?").get(req.params.id);
  if(!t) return res.status(404).json({error:"Test not found"});
  const access=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND (payment_status='paid' OR (SELECT price FROM courses WHERE id=course_id)=0)").get(req.user.id,t.course_id);
  if(!access) return res.status(403).json({error:"Enroll first"});
  t.questions=db.prepare("SELECT id,question,option_a,option_b,option_c,option_d FROM questions WHERE test_id=? ORDER BY id").all(t.id);
  res.json(t);
});
app.post("/api/tests/:id/submit",auth,(req,res)=>{
  const t=db.prepare("SELECT * FROM tests WHERE id=?").get(req.params.id);
  if(!t) return res.status(404).json({error:"Test not found"});
  const access=db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=? AND (payment_status='paid' OR (SELECT price FROM courses WHERE id=course_id)=0)").get(req.user.id,t.course_id);
  if(!access) return res.status(403).json({error:"Enroll first"});
  const answers=req.body.answers||{};
  const qs=db.prepare("SELECT id,correct FROM questions WHERE test_id=?").all(t.id);
  let score=0; for(const q of qs) if(answers[q.id]===q.correct) score++;
  const info=db.prepare("INSERT INTO results(user_id,test_id,score,total) VALUES(?,?,?,?)").run(req.user.id,t.id,score,qs.length);
  res.json({id:info.lastInsertRowid,score,total:qs.length,percentage:qs.length?Math.round(score*100/qs.length):0});
});

app.post("/api/payment/order",auth,(req,res)=>{
  const c=db.prepare("SELECT id,title,price FROM courses WHERE id=?").get(req.body.course_id);
  if(!c) return res.status(404).json({error:"Course not found"});
  if(!c.price) return res.json({free:true,message:"Free course"});
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)
    return res.status(503).json({error:"Payment gateway is not configured. Add Razorpay credentials to .env for live checkout."});
  res.status(501).json({error:"Razorpay SDK wiring is intentionally left for your merchant account configuration."});
});

app.get("/api/admin/stats",admin,(req,res)=>{
  res.json({
    students:db.prepare("SELECT COUNT(*) c FROM users WHERE role='student'").get().c,
    courses:db.prepare("SELECT COUNT(*) c FROM courses").get().c,
    enrollments:db.prepare("SELECT COUNT(*) c FROM enrollments").get().c,
    leads:db.prepare("SELECT COUNT(*) c FROM leads").get().c,
    results:db.prepare("SELECT COUNT(*) c FROM results").get().c
  });
});
app.get("/api/admin/students",admin,(req,res)=>res.json(db.prepare("SELECT id,name,email,phone,created_at FROM users WHERE role='student' ORDER BY id DESC").all()));
app.get("/api/admin/leads",admin,(req,res)=>res.json(db.prepare("SELECT * FROM leads ORDER BY id DESC").all()));
app.get("/api/admin/courses",admin,(req,res)=>res.json(db.prepare("SELECT * FROM courses ORDER BY id DESC").all()));
app.post("/api/admin/courses",admin,(req,res)=>{
  const {title,category,description,price,image}=req.body;
  if(!title||!category) return res.status(400).json({error:"Title and category required"});
  const x=db.prepare("INSERT INTO courses(title,category,description,price,image) VALUES(?,?,?,?,?)").run(title,category,description||"",Number(price)||0,image||"");
  res.json(db.prepare("SELECT * FROM courses WHERE id=?").get(x.lastInsertRowid));
});
app.put("/api/admin/courses/:id",admin,(req,res)=>{
  const {title,category,description,price,image,active}=req.body;
  db.prepare("UPDATE courses SET title=?,category=?,description=?,price=?,image=?,active=? WHERE id=?")
    .run(title,category,description||"",Number(price)||0,image||"",active?1:0,req.params.id);
  res.json({ok:true});
});
app.delete("/api/admin/courses/:id",admin,(req,res)=>{db.prepare("DELETE FROM courses WHERE id=?").run(req.params.id);res.json({ok:true});});

app.get("/api/admin/lessons/:courseId",admin,(req,res)=>res.json(db.prepare("SELECT * FROM lessons WHERE course_id=? ORDER BY sort_order,id").all(req.params.courseId)));
app.post("/api/admin/lessons",admin,(req,res)=>{
  const {course_id,title,video_url,notes_url,sort_order}=req.body;
  const x=db.prepare("INSERT INTO lessons(course_id,title,video_url,notes_url,sort_order) VALUES(?,?,?,?,?)").run(course_id,title,video_url||"",notes_url||"",Number(sort_order)||0);
  res.json({id:x.lastInsertRowid});
});
app.delete("/api/admin/lessons/:id",admin,(req,res)=>{db.prepare("DELETE FROM lessons WHERE id=?").run(req.params.id);res.json({ok:true});});

app.get("/api/admin/tests",admin,(req,res)=>res.json(db.prepare("SELECT t.*,c.title course_title,(SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) question_count FROM tests t LEFT JOIN courses c ON c.id=t.course_id ORDER BY t.id DESC").all()));
app.post("/api/admin/tests",admin,(req,res)=>{
  const {course_id,title,duration_minutes}=req.body;
  const x=db.prepare("INSERT INTO tests(course_id,title,duration_minutes) VALUES(?,?,?)").run(course_id||null,title,Number(duration_minutes)||30);
  res.json({id:x.lastInsertRowid});
});
app.post("/api/admin/questions",admin,(req,res)=>{
  const {test_id,question,option_a,option_b,option_c,option_d,correct}=req.body;
  if(!test_id||!question||!["A","B","C","D"].includes(correct)) return res.status(400).json({error:"Invalid question"});
  const x=db.prepare("INSERT INTO questions(test_id,question,option_a,option_b,option_c,option_d,correct) VALUES(?,?,?,?,?,?,?)").run(test_id,question,option_a,option_b,option_c,option_d,correct);
  res.json({id:x.lastInsertRowid});
});
app.delete("/api/admin/tests/:id",admin,(req,res)=>{db.prepare("DELETE FROM tests WHERE id=?").run(req.params.id);res.json({ok:true});});

app.get("/api/admin/notices",admin,(req,res)=>res.json(db.prepare("SELECT * FROM notices ORDER BY id DESC").all()));
app.post("/api/admin/notices",admin,(req,res)=>{
  const {title,body}=req.body;
  const x=db.prepare("INSERT INTO notices(title,body) VALUES(?,?)").run(title,body);
  res.json({id:x.lastInsertRowid});
});
app.delete("/api/admin/notices/:id",admin,(req,res)=>{db.prepare("DELETE FROM notices WHERE id=?").run(req.params.id);res.json({ok:true});});

app.get("/api/admin/results",admin,(req,res)=>res.json(db.prepare(`SELECT r.*,u.name,u.email,t.title test_title FROM results r JOIN users u ON u.id=r.user_id JOIN tests t ON t.id=r.test_id ORDER BY r.id DESC`).all()));

app.get("/api/admin/login-info",(req,res)=>res.json({username:ADMIN_USER}));

app.get("*", (req, res) => {
  const indexFile = path.join(publicDir, "index.html");
  if (!require("fs").existsSync(indexFile)) {
    return res.status(500).send(
      "Gurukul deployment error: public/index.html is missing. Upload the complete repository."
    );
  }
  res.sendFile(indexFile);
});
app.listen(PORT,()=>console.log(`Gurukul Coaching Centre running on http://localhost:${PORT}`));
