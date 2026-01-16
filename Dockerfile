FROM node:18-alpine as builder

WORKDIR /app

# نسخ ملف package.json فقط (بدون package-lock.json)
COPY frontend/package.json ./

# تثبيت التبعيات
RUN npm install

# نسخ باقي الملفات
COPY frontend/ ./

# بناء التطبيق
RUN npm run build

# مرحلة الإنتاج
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html

# إعداد nginx لـ React Router
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    location / { \
        try_files \ \/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
