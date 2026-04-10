# Этап сборки
FROM node:18-alpine as build

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости (используем ci для точной установки по lock-файлу)
RUN npm ci --only=production

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

# Открытие порта
EXPOSE 80

# Запуск nginx
CMD ["nginx", "-g", "daemon off;"]