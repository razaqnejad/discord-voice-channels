# Use Nginx as a static server
FROM nginx:alpine

# Copy client files to Nginx's HTML directory
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]
