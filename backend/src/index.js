const express=require("express")
const app=express()
const path=require("path")
const hbs=require("hbs")
const User=require("./mongodb")
app.use(express.static(path.join(__dirname, '../public')));
const templatePath=path.join(__dirname,'../templates')

app.use(express.json())
app.set("view engine","hbs")
app.set("views",templatePath)
app.use(express.urlencoded({extended:false}))
app.get("/login",(req,res)=>{
   res.render("login") 
})

app.get("/signup",(req,res)=>{
    res.render("signup") 
 })

app.post("/signup",async(req,res)=>{
    const userData={
        username:req.body.username,
        password:req.body.password
    }
    await User.insertMany([userData])
    res.render("home")
 })

 app.post("/login",async(req,res)=>{
    try{
 const checkUser=await User.findOne({username:req.body.username})
 if(checkUser.password===req.body.password){
    res.render("home")
 }
 else{
    res.send("Incorrect username or password")
 }
    }
    catch{
     res.send("Wrong credentials")
    }
 })

app.listen(3000,()=>{
    console.log("port connected");
})