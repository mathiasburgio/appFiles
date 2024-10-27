var modal = null;
var fechas = null;
var GLOBAL_DIRECTORIO_RAIZ = "/public";
var GLOBAL_PATH = "/public";
var GLOBAL_LISTADO = [];
var seleccionados = [];
var pagina = 0;
var buscar = "";

const bindEvents = () => {
    $("[name='iniciar-sesion']").click(ev=>{
        iniciarSesion();
    })
    $("[name='contrasena']").keyup(ev=>{
        if(ev.keyCode == 13) iniciarSesion();
    })
    $("[name='cerrar-sesion']").click(async ev=>{
        cerrarSesion();
    });
    $("[name='ir-al-directorio-superior']").click(async ev=>{
        let aux = GLOBAL_PATH.substring(0, GLOBAL_PATH.lastIndexOf("/"))
        if(aux != ""){
            pagina = 0;
            buscar = "";
            $("[name='pagina']").val(pagina);
            $("[name='buscar']").val(buscar);
            listarDirectorio(aux);
        }
    });
    $("[name='directorio-raiz']").change(async ev=>{
        let v = $(ev.currentTarget).val();
        pagina = 0;
        buscar = "";
        $("[name='pagina']").val(pagina);
        $("[name='buscar']").val(buscar);
        GLOBAL_DIRECTORIO_RAIZ = v;
        listarDirectorio(v);
    });
    $("[name='crear-directorio']").click(async ev=>{
        crearDirectorio();
    });
    $("[name='subir-archivo']").click(ev=>{
        subirArchivos();
    });
    $("[name='comprimir-seleccion']").click(ev=>{
        comprimir();
    });
    $("[name='eliminar-seleccion']").click(ev=>{
        eliminar(seleccionados);
    });

    $("[name='buscar']").keyup(ev=>{
        let v = $("[name='buscar']").val();
        if(ev.keyCode == 13){
            buscar = v;
            pagina = 0;
            $("[name='pagina']").val(pagina);
            listarDirectorio(GLOBAL_PATH);
        }
    })
    $("[name='paginaAnterior']").click(ev=>{
        pagina--;
        if(pagina <= 0) pagina = 0;
        $("[name='pagina']").val(pagina);
        listarDirectorio(GLOBAL_PATH);
    })
    $("[name='paginaSiguiente']").click(ev=>{
        pagina++;
        $("[name='pagina']").val(pagina);
        listarDirectorio(GLOBAL_PATH);
    })
    $("[name='pagina']").keyup(ev=>{
        let ele = $(ev.currentTarget);
        let v = parseInt(ele.val());
        if(!v || v <= 0) v = 0;
        ele.val(v);
        if(ev.keyCode == 13) listarDirectorio(GLOBAL_PATH);
    })
    

    if(window.location.href.indexOf("?admin") > -1){
        $("[name='login']").addClass("d-none");
        $("[name='gestion']").removeClass("d-none");
        let lastPath = localStorage.getItem("lastPath") || "/public";
        if(lastPath.indexOf("/private") == 0){
            $("[name='directorio-raiz']").val("/private");
            GLOBAL_DIRECTORIO_RAIZ = "/private";
        }
        listarDirectorio(lastPath);
    }
    $('[data-toggle="tooltip"]').tooltip()
}
const iniciarSesion = async () => {
    let data = {
        email: $("[name='email']").val(),
        contrasena: $("[name='contrasena']").val(),
    };
    if(!data?.email || !data?.contrasena) return;

    let ret = null;
    try{
        ret = await $.post({
            url: "/login",    
            data: data
        })
    }catch(err){
        console.log(err);
        modal.mensaje(err.responseText);
    }
    console.log(ret);
    if(ret.error){
        modal.mensaje(ret.message);
    }else{
        $("[name='login']").addClass("d-none");
        $("[name='gestion']").removeClass("d-none");
        listarDirectorio("/public");
    }
}
const cerrarSesion = async () => {
    let resp = await modal.pregunta("¿Cerrar sesión?");
    if(!resp) return;
    window.location.href = "/logout";
}

const listarDirectorio = async (ruta) =>{
    localStorage.setItem("lastPath", ruta);
    let ret = await $.get({
        url: `/list-folder?page=${pagina}&search=${buscar}&sortedBy=name`,
        data: { GLOBAL_PATH: ruta }
    })
    seleccionados = [];
    $("[name='comprimir-seleccion']").prop("disabled", true);
    $("[name='eliminar-seleccion']").prop("disabled", true);
    console.log(ret);
    if(ret.error){
        modal.mensaje(ret.message);
        return;
    }
    ret.fileDetails.sort((a,b)=>{
        if(a.type == "directory" && b.type == "file") return -1;
        else if(b.type == "directory" && a.type == "file") return 1;
        else if(a.type == b.type){
            if(a.name == "__counter.txt") return -1;
            if(b.name == "__counter.txt") return 1;
            
            else if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
            else if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
            return 0;
        }
        
    });
    GLOBAL_PATH = ruta;
    GLOBAL_LISTADO = ret.fileDetails;
    let contadores={directorios:0, archivos:0};

    $("[name='ruta-actual']").val(GLOBAL_PATH.substring(GLOBAL_DIRECTORIO_RAIZ.length));
    let tbody = "";
    ret.fileDetails.forEach((item, ind)=>{
        let icono = "<i class='fas fa-file text-primary'></i>";
        if(item.type != "file") icono = "<i class='fas fa-folder text-warning'></i>";
        if(item.type == "file" && item.name.endsWith(".zip"))  icono = "<i class='fas fa-file-zipper text-info'></i>";

        tbody += `<tr ind="${ind}">
            <td name="seleccionar" class="text-center"><i class='far fa-square'></i></td>
            <td>${icono}</td>
            <td>${item.name}</td>
            <td class="text-right">${item.size}</td>
            <td class="text-right">
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown" aria-expanded="false">
                        Acciones
                    </button>
                    <div class="dropdown-menu">
                        <a class="dropdown-item" href="#" name="abrir">Abrir</a>
                        <a class="dropdown-item" target="_blank" name="descargar" href="${GLOBAL_PATH + "/" + item.name}">Descargar</a>
                        <a class="dropdown-item" href="#" name="obtenerUrl">Obtener URL</a>
                        <a class="dropdown-item" href="#" name="renombrar">Renombrar</a>
                        <a class="dropdown-item" href="#" name="descomprimir">Descomprimir</a>
                        <a class="dropdown-item text-danger" href="#" name="eliminar">Eliminar</a>
                    </div>
                </div>
            </td>
        </tr>`;
    })
    $("table tbody").html(tbody);
    $("table tbody tr").each((ind, ev)=>{
        let row = $(ev);
        let item = GLOBAL_LISTADO[ind];
        if(item.type == "directory"){
            contadores.directorios++;
            row.find("[name='abrir']").removeClass("d-none");
            row.find("[name='descargar']").addClass("d-none");
        }else{
            contadores.archivos++;
            row.find("[name='abrir']").addClass("d-none");
            row.find("[name='descargar']").removeClass("d-none");
        }
        if(item.name.split(".").at(-1) == "zip"){
            row.find("[name='comprimir']").addClass("d-none");
            row.find("[name='descomprimir']").removeClass("d-none");
        }else{
            row.find("[name='comprimir']").removeClass("d-none");
            row.find("[name='descomprimir']").addClass("d-none");
        }
    });
    $("[name='contador']").html(`Directorios: ${contadores.directorios} - Archivos: ${contadores.archivos}`)
    $("table tbody [name='seleccionar']").click(ev=>{
        let celda= $(ev.currentTarget);
        let fila = celda.parent();
        let ind = parseInt( fila.attr("ind") );
        let item = GLOBAL_LISTADO[ind];
        celda.find("i").toggleClass("fa-square").toggleClass("fa-square-check").toggleClass("text-success")
        if(seleccionados.includes( item.name )){
            seleccionados = seleccionados.filter(s=>s != item.name);
        }else{
            seleccionados.push(item.name);
        }
        $("[name='comprimir-seleccion']").prop("disabled", seleccionados.length <= 0);
        $("[name='eliminar-seleccion']").prop("disabled", seleccionados.length <= 0);
    })
    $("table tbody [ind]").dblclick(async ev=>{
        let row = $(ev.currentTarget);
        let ind = row.attr("ind");
        let item = GLOBAL_LISTADO[ind];

        if(item.type == "directory"){
            pagina = 0;
            buscar = "";
            $("[name='pagina']").val(pagina);
            $("[name='buscar']").val("");

            listarDirectorio(GLOBAL_PATH + "/" + item.name);
        }else{
            let ext = item.name.split(".").at(-1).toLowerCase();
            if(["png", "jpg", "jpeg", "gif", "webp"].includes(ext)){
                modal.mostrar({
                    titulo: item.name,
                    cuerpo: `<img src='${GLOBAL_PATH + "/" + item.name}' style='max-width:100%; max-height: 60vh'>`,
                    tamano: "modal-lg",
                    botones: "volver"
                })
            }else if(["js", "txt", "json", "conf", "html", "css"].includes(ext)){
                modalEditor(item);
            }else{
                let w = window.open(GLOBAL_PATH + "/" + item.name, "_BLANK");
            }
        }
    })
    const getData = (event) => {
        let ele = $(event.currentTarget);
        let row = ele.parent().parent().parent().parent();
        let ind = parseInt(row.attr("ind"));
        let item = GLOBAL_LISTADO[ind];
        return {ele, row, ind, item};
    }
    $("table tbody [ind] [name='abrir']").click(async ev=>{
        let data = getData(ev);
        listarDirectorio(GLOBAL_PATH + "/" + data.item.name);
    });
    $("table tbody [ind] [name='obtenerUrl']").click(async ev=>{
        let data = getData(ev);
        modal.mostrar({
            titulo: "URL",
            cuerpo: $("#modal_url_completa").html(),
            tamano: "modal-lg",
            botones: "aceptar"
        })

        $("#modal input").val(window.location.origin + GLOBAL_PATH + "/" + data.item.name);
        $("#modal [name='copiar']").click(async ev=>{
            let v = $("#modal input").val();
            await navigator.clipboard.writeText(v);
        })
    });
    $("table tbody [ind] [name='renombrar']").click(async ev=>{
        let data = getData(ev);
        renombrar(data);
    });
    $("table tbody [ind] [name='eliminar']").click(async ev=>{
        let data = getData(ev);
        eliminar([data.item.name]);
    });
    $("table tbody [ind] [name='descomprimir']").click(async ev=>{
        let data = getData(ev);
        descomprimir(data);
    });
}
const crearDirectorio = async () => {
    let aux = await modal.prompt({label: "Nombre", type: "text", placeholder: "nombre del directorio"});
    console.log(aux);
    if(!aux) return;
    let ret = await $.post({
        url: "/create-folder",
        data: {
            GLOBAL_PATH: GLOBAL_PATH,
            name: aux
        }
    });
    console.log(ret);
    if(ret.error){
        modal.mensaje(ret.message);
        return;
    }
    listarDirectorio(GLOBAL_PATH);
}
const subirArchivos = async () => {
    
    modal.mostrar({
        titulo: "Subir archivos",
        cuerpo: $("#modal_subir_archivos").html(),
        tamano: "modal-lg",
        botones: "volver",
        fnOcultar: () => {
            listarDirectorio(GLOBAL_PATH);
        }
    })

    let files = [];
    $("#modal [type='file']").change(ev=>{
        let ele =$(ev.currentTarget);
        files = Array.from(ele[0].files);
        let tbody = "";
        files.forEach((file, ind)=>{
            tbody += `<li ind="${ind}" class="list-group-item d-flex justify-content-between align-items-center">
                        ${file.name}
                        <span class="badge badge-info badge-pill">Esperando</span>
                    </li>`;
        })
        $("#modal ul").html(tbody);
    })

    $("#modal [name='subir']").click(async ev=>{
        let irrepetible = $("#modal [name='irrepetible']").val();
        if(files.length == 0) return;
        if(irrepetible == null) return;

        $("#modal [name='subir']").prop("disabled", true);
        for(let findex in files){
            let file = files[findex];
            let span = $("#modal ul [ind='" + findex + "'] span");
            let subidaExitosa = await upload(file, irrepetible, progress=>{
                span.html(progress + "%");
            });
            if(subidaExitosa){
                span.addClass("badge-success").removeClass("badge-info").html("100%");
            }else{
                span.addClass("badge-danger").removeClass("badge-info").html("ERROR");
            }
        }
        $("#modal [name='subir']").prop("disabled", false);
    })

    const upload = (file, irrepetible, cbProgress) => {
        return new Promise(resolve=>{
            const formData = new FormData();
            formData.append('file', file);
            formData.append('GLOBAL_PATH', GLOBAL_PATH);
            formData.append('irrepetible', irrepetible);
        
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload', true);
            xhr.upload.addEventListener('progress', function(event) {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    if( cbProgress ) cbProgress(percentComplete.toFixed(2));
                }
            });
            xhr.addEventListener('load', function(resp) {
                let jsonResp = null;
                try{
                    jsonResp = JSON.parse(resp.target.response);
                }catch{
                    //no se pudo convertir la respuensta
                }
                if (xhr.status == 200) {
                    if( cbProgress ) cbProgress( 101 );//subio OK
                    resolve(true);
                } else {
                    modal.mensaje(resp.message)
                    resolve(false);
                }
            });
            xhr.send(formData);
        });
    }
}
const comprimir = async () =>{
    if(seleccionados.length == 0){
        modal.mensaje("Para comprimir debe seleccionar 1 ó más archivos/directorios.");
        return;
    }
    let nombre = await modal.prompt({label: "Nombre"});
    if(!nombre) return;
    
    let ret = await $.post({
        url: "/zip",
        data: {
            GLOBAL_PATH: GLOBAL_PATH,
            zipName: nombre,
            fileNames: JSON.stringify(seleccionados)
        }
    })
    listarDirectorio(GLOBAL_PATH);
}
const eliminar = async (seleccion) =>{
    let password = "";
    let pedirContrasena = false;
    if(seleccion.length > 1) pedirContrasena = true;

    seleccion.forEach(fx=>{
        let aux = GLOBAL_LISTADO.find(f=>f.name == fx);
        if(aux.type == "directory") pedirContrasena = true;
    })

    let resp = await modal.pregunta(`¿Confirma eliminar <b>${seleccion.length}</b> Archivos/Directorios?<br>${seleccion.join("<br>")}`);
    if(!resp) return;
    if(pedirContrasena) password = await modal.prompt({label: "Contraseña", type: "password"});

    let ret = await $.post({
        url: "/delete",
        data: {
            GLOBAL_PATH: GLOBAL_PATH,
            files: JSON.stringify(seleccion),
            password: password
        }
    })
    if(ret.error){
        modal.mensaje(ret.message);
    }else{
        listarDirectorio(GLOBAL_PATH);
    }
}
const descomprimir = async (data) =>{
    let fox = $("#modal_descomprimir").html();
    modal.mostrar({
        titulo: "Descomprimir",
        cuerpo: fox,
        botones: "volver"
    })
    $("#modal [name='nombre']").val(data.item.name.split(".zip")[0]);
    $("#modal [name='cancelar']").click(()=>{
        modal.ocultar();
    });
    $("#modal [name='descomprimir']").click(async()=>{
        let folder = $("#modal [name='nombre']").val();
        let ret = await $.post({
            url: "/unzip",
            data: {
                GLOBAL_PATH: GLOBAL_PATH,
                zipName: data.item.name,
                folder: folder
            }
        })
        console.log(ret);
        modal.ocultar(()=>{
            if(ret.error) modal.mensaje(ret.message);
            listarDirectorio(GLOBAL_PATH);
        });
    });
}
const renombrar = async (data) =>{
    let nuevoNombre = await modal.prompt({label: "Nombre", value: data.item.name});
    if(!nuevoNombre) return;

    let ret = await $.post({
        url: "/rename",
        data: {
            GLOBAL_PATH: GLOBAL_PATH,
            oldName: data.item.name,
            newName: nuevoNombre
        }
    })
    if(ret.error){
        modal.mensaje(ret.message);
    }else{
        listarDirectorio(GLOBAL_PATH);
    }
}
const modalEditor = async (item) => {
    let ext = item.name.split(".").at(-1).toLowerCase();
    let fox = `
    <textarea class='editor'></textarea>
    <div class='text-right mt-2'>
        <button class='btn btn-secondary' name='volver'>Volver</button>
        <button class='btn btn-success' name='guardar'>Guardar</button>
    </div>`
    modal.mostrar({
        titulo: item.name,
        cuerpo: fox,
        tamano: "modal-xl",
        footer: false
    })
    let modes = {
        js: "javascript", 
        html: "htmlmixed",
        css: "css",
        php: "php",
        sql: "sql",
        json: "javascript",
        conf: "javascript",
        txt: "javascript"
    }
    const editor = CodeMirror.fromTextArea(document.querySelector('#modal .editor'), {
        mode: modes[ext],  // Cambia según el tipo de archivo
        lineNumbers: true,
        theme: "material",  // Aplica el tema oscuro
    });

    const response = await fetch(GLOBAL_PATH + "/" + item.name);
    const fileContent = await response.text();
    setTimeout(()=> editor.setValue(fileContent), 250);
    $("#modal .CodeMirror").css("height", "70vh");

    $("#modal [name='volver']").click(()=>modal.ocultar());
    $("#modal [name='guardar']").click(async ev=>{
        let ele = $(ev.currentTarget);
        let resp = await modal.addAsyncPopover({querySelector: ele, message: "¿Confirma guardar los cambios?", type: "yesno"});
        if(!resp) return;
        $.post({
            url: "/save-text-file",
            data: {
                GLOBAL_PATH: GLOBAL_PATH,
                fileName: item.name,
                content: editor.getValue()
            }
        })
        modal.ocultar(()=>{
            modal.mensaje("¡Guardado con éxito!");
        })
    });
}

window.onload = () => {
    modal = new Modal();
    fechas = new Fechas();
    bindEvents();
}
