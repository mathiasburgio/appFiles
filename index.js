//FALTA SEGURIDAD ANTISPAM
const http = require("http");
const express = require("express");
const server = express();
const path = require("path");
const fs = require("fs");
const formidableMiddleware = require("express-formidable");
const session = require("express-session");
const FileStore = require('session-file-store')(session);
const cors = require("cors");
const favicon = require('serve-favicon');
const { v4: uuidv4 } = require('uuid');
const fechas = require("./src/resources/Fechas");
const unzipper = require("unzipper");
const archiver = require('archiver');

let folders_passwords = {};

require('dotenv').config({path:'./.env'})

// Lista de dominios permitidos
const allowedDomains = ['*'];
if(process.env.NODE_ENV == 'development') allowedDomains.push("http://localhost", "http://localhost:4000", "localhost");

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedDomains.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
server.use(cors(corsOptions));
server.use(formidableMiddleware())
server.use(session({
    secret: 'mateflix-asd-123',
    resave: true,
    saveUninitialized: false,
    cookie: {
        maxAge : (86400 * 1000),//la sesion dura 24hs
        //secure : !(process.env.NODE_ENV == 'development') // true ssl
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
    if(str == "") return false;
    if(typeof str != "string") return false;
}
const checkSession = (req) => {
    return (req?.session?.admin == true);
}
const checkPrivateKey = (req) =>{
    return (req?.fields?.privateKey === process.env.PRIVATE_KEY || req?.params?.privateKey === process.env.PRIVATE_KEY);
}
const checkFiles = async () => {
    let _private = path.join(__dirname, "private");
    let _public = path.join(__dirname, "public");
    let _private_password = path.join(__dirname, "private", "password.json");

    let private = fs.existsSync( _private );
    let public = fs.existsSync( _public );
    let private_password = fs.existsSync( _private_password );

    if(private == false) await fs.promises.mkdir( _private );
    if(public == false) await fs.promises.mkdir( _public );
    if(private_password == false) await fs.promises.writeFile( _private_password, JSON.stringify("{}") );

    folders_passwords = JSON.parse(await fs.promises.readFile( _private_password, "utf-8" ));
}
const sanitizeFileName = async (directory, fileName, hacerIrrepetible=true) =>{
    console.log("dir",directory);
    let cuentaArchivos = 0;
    try{
        if(hacerIrrepetible){
            let contador = await fs.promises.readFile( path.join(directory, "__counter.txt") , "utf-8");
            console.log("count", contador);
            cuentaArchivos = parseInt(contador) + 1;
            await fs.promises.writeFile(path.join(directory, "__counter.txt"), cuentaArchivos.toString());
        }
    }catch(err){
        cuentaArchivos = 0;
        await fs.promises.writeFile(path.join(directory, "__counter.txt"), cuentaArchivos.toString());
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
    const sanitized = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

    let ret = sanitized;
    if(hacerIrrepetible) ret = (ret + "_" + cuentaArchivos);
    if(extension) ret = (ret + "." + extension);
    return ret;
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

//url /private?filename=folder/hello.txt?password=asd123
server.get("/private", async(req, res)=>{
    try{
        const password = (req.query.password || "no-password-sended").toString();
        const filename = (req.query.filename || "no-filename-sended").toString();
    
        if(isValidName(folderPath) == false || isValidName(fileName) == false) throw "Ruta no válida";
        const finalPath = path.join(__dirname, "private", folderPath, fileName);
        if( folders_passwords?.[folderPath] == password ){
            res.sendFile(finalPath, (err)=>{
                if(err) res.json({error: true, message: "Archivo no encontrado" });
            });
        }else{
            throw "Contraseña no válida";
        }
    }catch(err){
        res.json({error: true, message: err.toString() });
    }
})
server.post("/private", async(req, res)=>{

})

let banderaLogin = false;

//este timer limpia el antispam
setInterval(()=>{
    banderaLogin = false;
}, 1000 * 60);

server.post("/login", (req, res)=>{
    try{
        if(banderaLogin == true) throw "Spam detectado, intente nuevamente en unos instantes";

        const email = (req.fields.email || "").toString().toLowerCase();
        const contrasena = (req.fields.contrasena || "");
        const _email = process.env.ADMIN_EMAIL;
        const _contrasena = process.env.ADMIN_CONTRASENA;

        if(email === _email && contrasena === _contrasena){
            req.session.admin = true;
            req.session.save();
            res.json({message: "OK"});
        }else{
            banderaLogin = true;
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
server.post(["/upload", "/upload/:privateKey"], async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        const folderPath = req.fields.folderPath;
        if(isValidName(folderPath) == false) throw "Ruta no válida";
        const files = req.files;
        const irrepetible = (req.fields?.irrepetible.toString() === "1");
        let newFiles = [];
        for(let file in files){
            let f = files[file];
            let newName = await sanitizeFileName( path.join(__dirname, folderPath), f.name, irrepetible);
            let newPath = path.join(__dirname, folderPath, newName);
            let ret = await fs.promises.rename(f.path, newPath);
            newFiles.push(newName);
        }
        res.json({message: "OK", newFiles: newFiles});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.post("/rename", async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        let oldPath = req.fields.oldPath;
        let newPath = req.fields.newPath;
        if(isValidName(oldPath) == false || isValidName(newPath) == false) throw "Ruta no válida";
        oldPath = path.join(__dirname, oldPath);
        newPath = path.join(__dirname, newPath);
        let ret = await fs.promises.rename(oldPath, newPath);
        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.post("/delete", async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        const removePath = req.fields.removePath;
        const password = req.fields.password;
        const type = req.fields.type;
        if(isValidName(removePath) == false) throw "Ruta no válida";
        let ret = null;
        if(type=="directory"){
            if(process.env.ADMIN_CONTRASENA != password) throw "Contraseña no válida";
            ret = await fs.promises.rm( path.join(__dirname, removePath) , {recursive: true, force: true});
        }else{
            ret = await fs.promises.unlink( path.join(__dirname, removePath) );
        }
        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
});
server.post("/unzip", async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        const finalPath = req.fields.finalPath;
        const zipPath = req.fields.zipPath;
        if(isValidName(finalPath) == false) throw "Ruta final no válida";
        if(isValidName(zipPath) == false) throw "Ruta zip no válida";
        
        const zip = await unzipper.Open.file( path.join(__dirname, zipPath) );
        if(fs.existsSync( path.join(__dirname, finalPath) ) == false) fs.mkdirSync( path.join(__dirname, finalPath) );
        await zip.extract({ path: path.join(__dirname, finalPath) })
        res.json({message: "OK"});
    }catch(err){
        res.json({error: true, message: err.toString()});
    } 
})
server.post("/zip", async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        let GLOBAL_PATH = req.fields.GLOBAL_PATH;//directorio base
        let zipName = req.fields.zipName;//nombre del zip resultante
        let fileNames = JSON.parse(req.fields?.fileNames || "[]");//archivos a comprimir
        

        if(isValidName(GLOBAL_PATH) == false) throw "GLOBAL_PATH no válido";
        if(isValidName(zipName) == false) throw "zipName no válido";
        if(zipName.endsWith(".zip") == false) zipName = zipName + ".zip";

        const output = fs.createWriteStream( path.join(__dirname, GLOBAL_PATH, zipName) );
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
server.get(["/list-folder", "/list-folder/:privateKey"], async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        let folderPath = req.query.folderPath;
        if(isValidName(folderPath) == false) throw "Ruta no válida";
        folderPath = path.join(__dirname, folderPath);
        let files = await fs.promises.readdir(folderPath);

        const fileDetailsPromises = files.map(async (file) => {
            const filePath = path.join(folderPath, file);

            try {
                const stats = await fs.promises.stat(filePath);
                
                return {
                    name: file,
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

        res.json({message: "OK", fileDetails});
    }catch(err){
        res.json({error: true, message: err.toString()});
    }
})
server.post("/create-folder", async(req, res)=>{
    try{
        if(checkSession(req) == false && checkPrivateKey(req)) throw "Usuario no válido";
        const folderPath = req.fields.folderPath + "/" + req.fields.folderName;
        if(isValidName(folderPath) == false) throw "Ruta no válida";
        if(folderPath.indexOf("/private") === 0){
            const password = (req.fields?.password || "no-password").toString();
            if(typeof folders_passwords?.[folderPath] != "undefined"){
                throw "El directorio ya existe";
            }else{
                folders_passwords[folderPath] = password;
                let ret = await fs.promises.mkdir(folderPath);
                let ret2 = await fs.promises.writeFile( path.join(__dirname, "private", "password.json"), JSON.stringify(folders_passwords) );
            }
        }
        let ret = await fs.promises.mkdir(path.join(__dirname, folderPath));
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
console.log(`Listen 4000 # ${fechas.getNow(true)}`);
