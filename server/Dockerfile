# استفاده از نسخه LTS رسمی Node.js
FROM node:18

# تنظیم مسیر کار
WORKDIR /app

# کپی کردن فایل‌های پروژه به داخل کانتینر
COPY package.json package-lock.json ./
RUN npm install

# کپی کردن بقیه فایل‌های سرور
COPY . .

# پورت مورد استفاده در کانتینر
EXPOSE 3000

# اجرای سرور
CMD ["node", "index.js"]
