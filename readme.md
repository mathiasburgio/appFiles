# Proyecto de Servidor de Archivos Estáticos

Este proyecto tiene como objetivo servir archivos estáticos, tanto de forma pública como privada.

## Configuración

Al clonar este repositorio, debes copiar (o reemplazar) el archivo `.env_example` y renombrarlo a `.env`. Luego, reemplaza la información interna para adaptarla a tus necesidades.  

## Crear usuario

Ingresar a `dominio.com/create-user?email=someone@gmail.com&password=123asd` y cambie `email` y `password` con las credenciales que va a utilizar para ingresar al panel. En caso de querer editar el usuario borre el archivo `.user`.  

## Como utilizar la API

Para cualquier consulta `POST` se debe utilizar el parametro `privateKey` que debe ser igual al que se encuentra en `.env`

## Funciones

1.  POST /upload  
>GLOBAL_PATH //empezando con `/public` (ó `/private`) notese mayuscula  
>files //array de archivos  
>irrepetible //1 ó 0 (def 0);  
