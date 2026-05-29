# App migrada: imagen solo de nginx que muestra una página de aviso y
# redirige todo el tráfico al nuevo sitio tras 3 segundos.
# Ya no se compila React (no se sirve nada de la SPA).
FROM nginx:alpine AS production

COPY redirect.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
