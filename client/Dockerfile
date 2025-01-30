# استفاده از nginx برای سرو کردن کلاینت
FROM nginx:alpine

# کپی کردن فایل‌های کلاینت به مسیر nginx
COPY . /usr/share/nginx/html

# پورت پیش‌فرض Nginx
EXPOSE 80

# اجرای سرور Nginx
CMD ["nginx", "-g", "daemon off;"]
