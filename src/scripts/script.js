var modal = null;
var fechas = null;
var GLOBAL_DIRECTORIO_RAIZ = "/public";
var GLOBAL_PATH = "/public";
var GLOBAL_LISTADO = [];

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
        if(aux != "") listarDirectorio(aux);
    });
    $("[name='directorio-raiz']").change(async ev=>{
        let v = $(ev.currentTarget).val();
        GLOBAL_DIRECTORIO_RAIZ = v;
        listarDirectorio(v);
    });
    $("[name='subir-archivo']").click(async ev=>{
        subirArchivos();
    });
    $("[name='crear-directorio']").click(async ev=>{
        crearDirectorio();
    });

    if(window.location.href.indexOf("?admin") > -1){
        $("[name='login']").addClass("d-none");
        $("[name='gestion']").removeClass("d-none");
        listarDirectorio("/public");
    }
    $('[data-toggle="tooltip"]').tooltip()
}
const iniciarSesion = async () => {
    let data = {
        email: $("[name='email']").val(),
        contrasena: $("[name='contrasena']").val(),
    };
    if(!data?.email || !data?.contrasena) return;

    let ret = await $.post({
        url: "/login",    
        data: data
    })
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
const crearDirectorio = async () => {
    let aux = await modal.prompt({label: "Nombre", type: "text", placeholder: "nombre del directorio"});
    console.log(aux);
    if(!aux) return;
    let ret = await $.post({
        url: "/create-folder",
        data: {
            folderPath: GLOBAL_PATH,
            folderName: aux
        }
    });
    console.log(ret);
    if(ret.error){
        modal.mensaje(ret.message);
        return;
    }
    listarDirectorio(GLOBAL_PATH);
}
const listarDirectorio = async (ruta) =>{
    let ret = await $.get({
        url: "/list-folder",
        data: {
            folderPath: ruta
        }
    })
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

    $("[name='ruta-actual']").val(GLOBAL_PATH.substring(GLOBAL_DIRECTORIO_RAIZ.length));
    let tbody = "";
    ret.fileDetails.forEach((item, ind)=>{
        let icono = "<i class='fas fa-file text-primary'></i>";
        if(item.type != "file") icono = "<i class='fas fa-folder text-warning'></i>";

        tbody += `<tr ind="${ind}">
            <td class="text-center">${icono}</td>
            <td>${item.name}</td>
            <td class="text-right">${item.size}</td>
            <td class="text-right">
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" ${item.type != "file" && "disabled"} class="btn btn-primary dropdown-toggle" data-toggle="dropdown" aria-expanded="false">
                        Acciones
                    </button>
                    <div class="dropdown-menu">
                        <a class="dropdown-item" target="_blank" href="${GLOBAL_PATH + "/" + item.name}">Descargar</a>
                        <a class="dropdown-item" href="#" name="renombrar">Renombrar</a>
                        <a class="dropdown-item" href="#" name="descomprimir">Descomprimir</a>
                        <a class="dropdown-item text-danger" href="#" name="eliminar">Eliminar</a>
                    </div>
                </div>
            </td>
        </tr>`;
    })
    $("table tbody").html(tbody);
    $("table tbody [ind]").click(ev=>{
        let ele = $(ev.currentTarget);
        let ind = parseInt(ele.attr("ind"));
        let item = GLOBAL_LISTADO[ind];
        console.log(item);
        if(item.type == "directory") listarDirectorio(GLOBAL_PATH + "/" + item.name);
    })

    $("table tbody [ind] [name='renombrar']").click(async ev=>{
        let ele = $(ev.currentTarget);
        let row = ele.parent().parent().parent().parent();
        let ind = parseInt(row.attr("ind"));
        let item = GLOBAL_LISTADO[ind];
        let nuevoNombre = await modal.prompt({label: "Nombre", value: item.name});
        if(!nuevoNombre) return;

        let ret = await $.post({
            url: "/rename-file",
            data: {
                oldPath: GLOBAL_PATH + "/" + item.name,
                newPath: GLOBAL_PATH + "/" + nuevoNombre
            }
        })
        if(ret.error){
            modal.mensaje(ret.message);
        }else{
            listarDirectorio(GLOBAL_PATH);
        }
    });
    $("table tbody [ind] [name='eliminar']").click(async ev=>{
        let ele = $(ev.currentTarget);
        let row = ele.parent().parent().parent().parent();
        let ind = parseInt(row.attr("ind"));
        let item = GLOBAL_LISTADO[ind];
        let resp = await modal.pregunta(`Confirma eliminar el archivo<br><b>${item.name}</b>`);
        if(!resp) return;
        let ret = await $.post({
            url: "/delete-file",
            data: {
                filepath: GLOBAL_PATH + "/" + item.name
            }
        })
        if(ret.error){
            modal.mensaje(ret.message);
        }else{
            listarDirectorio(GLOBAL_PATH);
        }
    });
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
            formData.append('folderPath', GLOBAL_PATH);
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

window.onload = () => {
    modal = new Modal();
    fechas = new Fechas();
    bindEvents();
}
