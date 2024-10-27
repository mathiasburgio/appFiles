//FALTA SEGURIDAD ANTISPAM
const http = require("http");
const express = require("express");
const server = express();
const path = require("path");
const fs = require("fs");
//const formidableMiddleware = require("express-formidable");
const session = require("express-session");
const FileStore = require('session-file-store')(session);
const cors = require("cors");
const favicon = require('serve-favicon');
const { v4: uuidv4 } = require('uuid');
const fechas = require("./src/resources/Fechas");
const unzipper = require("unzipper");
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { randomUUID } = require("crypto");
const multer =  require("multer");
const upload = multer({ dest: 'temp/' }); // Directorio de subida

//gestiona el contador para hacer archivos "irrepetibles"
let irrepetibleCounter = 0;

require('dotenv').config({path:'./.env'})

const loginLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5, // Limita a 5 intentos por IP
    message: "Demasiados intentos de login. Intente nuevamente más tarde."
});

// Lista de dominios permitidos
const allowedDomains = ['*'];
if(process.env.NODE_ENV == 'development') allowedDomains.push("http://localhost", "http://localhost:4000", "localhost");

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedDomains.indexOf(origin) !== -1 || !origin || allowedDomains.includes("*")) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
server.use(cors(corsOptions));
// Analizar cuerpos de solicitud en formato JSON
server.use(express.json());
// Analizar cuerpos de solicitud con datos de formularios clásicos (URL-encoded)
server.use(express.urlencoded({ extended: true }));
//server.use(formidableMiddleware())
server.use(session({
    secret: 'mateflix-asd-123',
    resave: true,
    saveUninitialized: false,
    cookie: {
        maxAge : (86400 * 1000),//la sesion dura 24hs
        //secure : process.env.NODE_ENV != 'development' // true ssl
    },
    store: new FileStore({logFn: function(){}})//loFn: ... es para q no joda buscando sessiones q han sido cerradas
}));
server.use( favicon(__dirname + "/src/resources/icon.ico") )
server.use("/public", express.static(__dirname + "/public"));
server.use("/styles", express.static(__dirname + "/src/styles"));
server.use("/scripts", express.static(__dirname + "/src/scripts"));
server.use("/views", express.static(__dirname + "/src/views"));
server.use("/resources", express.static(__dirname + "/src/resources"));


const isValidName = (str) =>{
    if(str.indexOf("..") > -1) return false;
    if(str.indexOf(" ") > -1) return false;
    if(str.indexOf("~") > -1) return false;
    if(str == "") return false;
    if(typeof str != "string") return false;
    return true;
}
const isValidPath = (base="public", userPath="") => {
    let basePath = path.join(__dirname, base);
    userPath = userPath.replaceAll("/", "\\");//cambia a formato unix
    const resolvedPath = path.resolve(basePath, userPath);
    if(resolvedPath.indexOf("~") > -1) return false;
    return resolvedPath.startsWith(basePath);
};
const checkSession = (req) => {
    return (req?.session?.admin == true);
}
const checkPrivateKey = (req) =>{
    return (req?.fields?.privateKey === process.env.PRIVATE_KEY || req?.body?.privateKey === process.env.PRIVATE_KEY);
}
const requireAuth = (req, res, next) =>{
    if (!checkSession(req) && !checkPrivateKey(req)) {
        return res.status(403).json({ error: "Acceso no autorizado" });
    }
    next();
}
const checkFiles = async () => {
    let _private = path.join(__dirname, "private");
    let _public = path.join(__dirname, "public");
    let _temp = path.join(__dirname, "temp");

    let private = fs.existsSync( _private );
    let public = fs.existsSync( _public );
    let temp = fs.existsSync( _temp );

    if(private == false) await fs.promises.mkdir( _private );
    if(public == false) await fs.promises.mkdir( _public );
    if(temp == false) await fs.promises.mkdir( _temp );

    if(fs.existsSync( path.join(__dirname, ".irrepetibleCounter") )){
        let aux = fs.readFileSync( path.join(__dirname, ".irrepetibleCounter"), "utf-8");
        irrepetibleCounter = parseInt(aux) || 0;
    }else{
        fs.writeFileSync( path.join(__dirname, ".irrepetibleCounter"), "0");
    }
}
const sanitizeFileName = async (directory, fileName, hacerIrrepetible=true) =>{
    if(hacerIrrepetible){
        irrepetibleCounter++;
        await fs.promises.writeFile(path.join(__dirname, ".irrepetibleCounter"), irrepetibleCounter.toString());
    }
    
    // Divide el nombre del archivo y la extensión
    const parts = fileName.split('.');
    let extension = null;
    if (parts.length >= 2) {
        extension = parts.pop();
    }
    
    // Reunir las partes restantes del nombre del archivo
    const name = parts.join('.');

    // Reemplazar espacios con guiones medios y eliminar caracteres no alfanuméricos (excepto guiones medios)
    const sanitized = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-\_]/g, '');

    let ret = sanitized;
    if(hacerIrrepetible) ret = (ret + "_" + irrepetibleCounter);
    if(extension) ret = (ret + "." + extension);
    return ret;
}
const simpleString = (str = "", noSpaces = false) => {
    str = ("" + str).toLowerCase().trim();
    str = str.replaceAll("á", "a");
    str = str.replaceAll("é", "e");
    str = str.replaceAll("í", "i");
    str = str.replaceAll("ó", "o");
    str = str.replaceAll("ú", "u");
    str = str.replaceAll("ñ", "n");
    str = str.replace(/[^a-z0-9 -\.]/gi, '').toLowerCase().trim();
    if(noSpaces){
        return str.replaceAll(" ", "-")
    }else{
        return str
    }
}
server.get("/ping", (req, res)=>{
    res.send("pong");
    res.end();
})
server.get(["/", "/index", "/index.html"], (req, res)=>{
    let esAdmin = (req?.session?.admin ? "?admin" : "");
    if(esAdmin && Object.keys(req.query).length == 0){
        res.redirect("/index?admin");
        return;
    }
    res.sendFile( path.join(__dirname, "src", "views", "index.html") );
})
server.get(["/private", "/private/*"], requireAuth, async(req, res)=>{
    try{
        const filePath = path.join(__dirname, 'private', req.params[0]);

        // Verifica si el archivo existe
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        } else {
            return res.status(404).json({ message: 'Archivo no encontrado' });
        }
    }catch(err){
        res.send("Clave no válida o recurso no encontrado");
        res.end();
    }
});
server.post("/login", upload.any(), loginLimiter, async (req, res)=>{
    try{
        const email = (req.body.email || "").toString().toLowerCase();
        const contrasena = (req.body.contrasena || "");

        if(email === process.env.EMAIL && contrasena === process.env.PASSWORD){
            req.session.admin = true;
            req.session.save();
            res.json({message: "OK"});
        }else{
            throw "Combinación no válida";
        }
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.post("/logout", (req, res)=>{
    req.session.destroy();
    res.end();
});
server.get("/logout", (req, res)=>{
    req.session.destroy();
    res.redirect("/");
});
//la autenticacion de usuario la hago intermanete
server.post(["/upload", "/upload-multiple"], upload.any(), async(req, res)=>{
    try{
        if( checkSession(req) == false && checkPrivateKey(req) == false) throw "Usuario no válido";
        
        const GLOBAL_PATH = req.body.GLOBAL_PATH;
        if(isValidName(GLOBAL_PATH) == false) throw "Ruta no válida (código 1)";
        const files = req.files;
        const replaceName = (req.body?.newName || "").toString(); 
        const irrepetible = ((req.body?.irrepetible || "0").toString() === "1");
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";
        let newFiles = [];
        for(let file in files){
            let f = files[file];
            let newName = await sanitizeFileName( path.join(__dirname, GLOBAL_PATH), (replaceName || f.originalname), irrepetible);
            let newPath = path.join(__dirname, GLOBAL_PATH, newName);
            if(isValidPath(base, newPath) == false) throw "Ruta no válida (código 3)";
            let ret = await fs.promises.rename(f.path, newPath);
            newFiles.push(newName);
        }
        res.json({message: "OK", newFiles: newFiles});
    }catch(err){
        console.log(err);
        res.json({error: true, message: err.toString()});
    }
});
server.post("/save-text-file", requireAuth, async(req, res)=>{
    try{
        const GLOBAL_PATH = req.body.GLOBAL_PATH;
        let fileName = req.body.fileName;
        let content = (req.body?.content || "").toString();
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";
        if(isValidName(fileName) == false) throw "Ruta no válida";
        let fullPath = path.join(__dirname, GLOBAL_PATH, fileName);
        if(isValidPath(base, fullPath) == false) throw "Ruta no válida (código 3)";
        fs.writeFileSync( fullPath, content);
        res.json({message: "OK"});
    }catch(err){
        console.log(err);
        res.json({error: true, message: err.toString()});
    }
});
server.post("/rename", requireAuth, async(req, res)=>{
    try{
        const GLOBAL_PATH = req.body.GLOBAL_PATH;
        let oldName = req.body.oldName;
        let newName = req.body.newName;
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";
        if(isValidName(oldName) == false || isValidName(newName) == false) throw "Ruta no válida";
        let oldPath = path.join(__dirname, GLOBAL_PATH, oldName);
        let newPath = path.join(__dirname, GLOBAL_PATH, newName);
        if(isValidPath(base, oldPath) == false) throw "Ruta no válida (código 3)";
        if(isValidPath(base, newPath) == false) throw "Ruta no válida (código 3)";
        let ret = await fs.promises.rename(oldPath, newPath);
        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.post("/delete", requireAuth, async(req, res)=>{
    try{
        const GLOBAL_PATH = req.body.GLOBAL_PATH;
        const files = JSON.parse(req.body.files || "[]");
        const password = req.body.password;
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";

        if(Array.isArray(files) == false) throw "Selección no válida";
        if(files.length > 1 && process.env.ADMIN_CONTRASENA != password) throw "Contraseña no válida";

        for(let file of files){
            console.log(file);
            let fullPath = path.join( __dirname, GLOBAL_PATH, file);
            if(isValidName(fullPath) == false) throw "Ruta no válida (código 1)";
            if(isValidPath(base, fullPath) == false) throw "Ruta no válida (código 2)";
            const stats = await fs.promises.stat(fullPath);
            if( stats.isDirectory() ){
                ret = await fs.promises.rm( fullPath , {recursive: true, force: true});
            }else{
                ret = await fs.promises.unlink( fullPath );
            } 
        }

        if(private) fs.promises.writeFile( path.join(__dirname, ".privateSecret"), JSON.stringify(privateSecret));
        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.post("/unzip", requireAuth, async(req, res)=>{
    try{
        const GLOBAL_PATH = req.body.GLOBAL_PATH;
        const zipName = req.body.zipName;
        const folder = (req.body?.folder || "").toString();
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";
        
        const zipPath = path.join(__dirname, GLOBAL_PATH, zipName);
        const finalPath = path.join(__dirname, GLOBAL_PATH, folder);
        
        if(isValidName(zipPath) == false) throw "Ruta zip no válida";
        if(isValidName(finalPath) == false) throw "Ruta final no válida";
        if(isValidPath(base, zipPath) == false) throw "Ruta zip no válida (cod 2)";
        if(isValidPath(base, finalPath) == false) throw "Ruta final no válida (cod 2)";
        
        const zip = await unzipper.Open.file( zipPath );
        if(fs.existsSync( finalPath ) == false) fs.mkdirSync( finalPath );
        for(let entry of zip.files){
            const extractedPath = path.resolve(finalPath, entry.path);
            if(isValidName(extractedPath) == false) throw "Ruta zip no válida (cod 3)";
            if(extractedPath.startsWith(finalPath) == false) throw "Ruta zip no válida (cod 4)";
        }
        await zip.extract({ path: finalPath })
        res.json({message: "OK"});
    }catch(err){
        console.log(err);
        res.json({error: true, message: err.toString()});
    } 
})
server.post("/zip", requireAuth, async(req, res)=>{
    try{
        let GLOBAL_PATH = req.body.GLOBAL_PATH;//directorio base
        let zipName = req.body.zipName;//nombre del zip resultante
        let fileNames = JSON.parse(req.body?.fileNames || "[]");//archivos a comprimir
        let fullPath = path.join(__dirname, GLOBAL_PATH, zipName);
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";

        if(isValidName(fullPath) == false) throw "GLOBAL_PATH no válido";
        if(isValidPath(base, fullPath) == false) throw "zipName no válido";
        if(fullPath.endsWith(".zip") == false) fullPath = fullPath + ".zip";

        const output = fs.createWriteStream( fullPath );
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // Asociar la salida del archivo al stream de escritura
        archive.pipe(output);

        archive.on('error', function(err) {
            throw err;
        });
        
        // Agregar los archivos al ZIP
        fileNames.forEach(filePath => {
            let px = path.join(__dirname, GLOBAL_PATH, filePath);
            if(isValidName(px) == false) throw "error cod 1";
            if(isValidPath(base, px) == false) throw "error cod 2";

            if (fs.lstatSync(px).isDirectory()) {
                // Si es un directorio, agregar todo su contenido
                archive.directory(px, path.basename(px));
            } else {
                // Si es un archivo, agregarlo directamente
                archive.file(px, { name: filePath });
            }
        });

        

        // Finalizar la creación del ZIP
        archive.finalize();

        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    } 
})
server.get("/list-folder", requireAuth, async(req, res)=>{
    try{
        let page = Number(req?.query?.page || 0);
        let itemsPerPage = 100;
        let sortedBy = req?.query?.sortedBy || null; //name || birthday || size || lastChangeTime
        let search = simpleString(req?.query?.search || ""); //compare with sortedBy (sortedBy = null compare with index). example: startFrom=someFile.json || startFrom=2010-01-01         
        
        //console.log({itemsPerPage, page, sortedBy, search});

        let GLOBAL_PATH = req.query.GLOBAL_PATH;
        let fullPath = path.join(__dirname, GLOBAL_PATH);
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";
        if(isValidName(fullPath) == false) throw "Ruta no válida";
        if(isValidPath(base, fullPath) == false && isValidPath(false, fullPath) == false) throw "Ruta no válida";
        let files = await fs.promises.readdir( fullPath );

        //obtengo metadata de archivos
        const fileDetailsPromises = files.map(async (file) => {
            const filePath = path.join(fullPath, file);

            try {
                const stats = await fs.promises.stat(filePath);
                
                return {
                    name: file,
                    birthtime: stats.birthtime,
                    lastChangeTime: stats.mtime,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    size: stats.isFile() ? ((stats.size / 1024).toFixed(2) + "KB") : 'N/A' // Tamaño solo para archivos
                };
            } catch (error) {
                console.error(`No se pudo obtener información de ${file}:`, error.message);
                return {
                    name: file,
                    type: 'unknown',
                    size: 'Error'
                };
            }
        });

        // Esperar a que todas las promesas se resuelvan
        const fileDetails = await Promise.all(fileDetailsPromises);

        //ordeno
        if(sortedBy == "name"){
            fileDetails.sort((a, b) => a.name.localeCompare(b.name));
        }else if(sortedBy == "birthday"){
            fileDetails.sort((a, b) => b.birthtime - a.birthtime);
        }else if(sortedBy == "lastChangeTime"){
            fileDetails.sort((a, b) => b.lastChangeTime - a.lastChangeTime);
        }else if(sortedBy == "size"){
            fileDetails.sort((a, b) => Number(b.size) - Number(a.lastChangeTime));
        }

        let ret = [];
        let pageDelta = itemsPerPage * page;
        let coincidences = 0;
        fileDetails.forEach((file, index)=>{
            if(ret.length >= itemsPerPage) return; //omito si ta termine los items por pagina
            if(!search || simpleString(file.name).indexOf(search) > -1){ 
                coincidences++;
                if(pageDelta > 0){
                    pageDelta--;// Saltar elementos de páginas anteriores
                }else{
                    ret.push(file);// Agregar al resultado si ya estamos en la página actual
                }
            }
        })

        res.json({message: "OK", fileDetails: ret, coincidences});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
})
server.post("/create-folder", requireAuth, async(req, res)=>{
    try{
        const GLOBAL_PATH = req.body.GLOBAL_PATH;
        const name = req.body.name;
        const finalPath = path.join(__dirname, GLOBAL_PATH, name);
        const private = GLOBAL_PATH.startsWith("/private");
        const base = private ? "private" : "public";
        
        if(isValidName(finalPath) == false) throw "Ruta no válida";
        if(isValidPath(base, finalPath) == false) throw "Ruta no válida";
        if(fs.existsSync( finalPath ) == false) await fs.promises.mkdir( finalPath );
        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.use((req, res, next) => {
    res.status(404).sendFile(__dirname + "/src/views/404.html")
})

const httpServer = http.createServer(server);
httpServer.listen(4000);
checkFiles();//verifica las carpetas principales y carga contraseñas
console.log(`Listen 4000 # ${fechas.getNow(true)} # http://localhost:4000 (Ctrl + click)`);
