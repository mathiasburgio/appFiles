# Proyecto de Servidor de Archivos Estáticos

Este proyecto tiene como objetivo servir archivos estáticos, tanto de forma pública como privada.

## Configuración

Al clonar este repositorio, debes copiar (o reemplazar) el archivo `.env_example` y renombrarlo a `.env`. Luego, reemplaza la información interna para adaptarla a tus necesidades.  

## Crear usuario

Ingresar a `dominio.com/create-user?email=someone@gmail.com&password=123asd` y cambie `email` y `password` con las credenciales que va a utilizar para ingresar al panel. En caso de querer editar el usuario borre el archivo `.user`.  

## Como utilizar la API

Para cualquier consulta `POST` se debe utilizar el parametro `privateKey` que debe ser igual al que se encuentra en `.env`  
Tambien todas las consultas requieren el parametro `GLOBAL_PATH` haciendo referencia a la carpeta en la cual se trabajará y deberá comenzar con "/public" ó "/private"

## API endpoints

.  POST /upload  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>files //array de archivos  
>irrepetible //1 ó 0 (def 0);

.  POST /rename  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>oldName //string
>newName //string

.  POST /delete  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>files //array de nombres de archivos  
>password //string requerido para borrar carpetas ó mas de 1 archivo a la vez

.  POST /unzip  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>zipName //string nombre del archivo
>folder //string nombre del directorio donde se descomprimira. Si no existe se crea, si esta vacio se descomprime en el mismo directorio de GLOBAL_PATH

.  POST /zip  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>zipName //string nombre del archivo una vez zipeado  
>fileNames //array de nombres de archivos  

.  GET /list-folder/:privateKey?GLOBAL_PATH  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>files //array de archivos  
>irrepetible //1 ó 0 (def 0);

.  POST /create-folder  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>name //string

.  POST /save-text-file  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>fileName //string
>content //string
