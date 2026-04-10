# Этап сборки
FROM node:18-alpine as build

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости (используем install вместо ci)
RUN npm install --omit=dev

# Копируем исходный код
COPY public/ ./public/
COPY src/ ./src/

# Сборка приложения
RUN npm run build

# Этап продакшена
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=build /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]