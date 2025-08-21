// html-to-pdf-service/index.js
const express = require('express');
const bodyParser = require('body-parser');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs'); // Не используется в текущей версии, но может быть полезен

const app = express();
// Railway назначает порт через переменную окружения PORT.
// Если PORT не задан (например, при локальном запуске), используем 3000.
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Парсим тела запросов.
// 'text/html' для получения чистого HTML.
// 'application/json' на случай, если будете передавать HTML в JSON.
// Увеличиваем лимит размера на всякий случай, если будут большие HTML.
app.use(bodyParser.text({ limit: '50mb', type: 'text/html' }));
app.use(bodyParser.json({ limit: '50mb' }));

// --- Маршруты ---

// Эндпоинт для проверки работоспособности сервиса (health check)
app.get('/health', (req, res) => {
    res.status(200).send('PDF Converter Service is healthy!');
});

// Основной эндпоинт для конвертации HTML в PDF
app.post('/convert-to-pdf', async (req, res) => {
    const htmlContent = req.body; // Получаем HTML из тела запроса

    // Проверка наличия HTML
    if (!htmlContent) {
        console.error("Received empty HTML content.");
        return res.status(400).send('No HTML content provided.');
    }

    let browser = null; // Инициализируем переменную для браузера
    try {
        // Получаем путь к исполняемому файлу Chromium, предоставленный @sparticuz/chromium
        // process.env.CHROME_EXECUTABLE_PATH = await chromium.executablePath; // Set path if you're on certain serverless platforms where it's dynamically set.
        const executablePath = await chromium.executablePath; // For most hosting environments including Railway.

        // Запускаем браузер Puppeteer
        browser = await puppeteer.launch({
            args: chromium.args, // Аргументы для запуска Chromium в headless режиме
            executablePath: executablePath, // Путь к исполняемому файлу Chromium
            headless: chromium.headless, // Указываем, что браузер работает в headless режиме
        });

        const page = await browser.newPage(); // Открываем новую страницу

        // Устанавливаем HTML-контент на страницу.
        // waitUntil: 'networkidle0' ожидает, пока сетевая активность не прекратится.
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Генерируем PDF
        const pdfBuffer = await page.pdf({
            format: 'A4', // Формат бумаги
            printBackground: true, // Печатать фоновые цвета и изображения
            margin: { // Настройка полей
                top: '20mm',
                bottom: '20mm',
                left: '10mm',
                right: '10mm'
            }
        });

        // Устанавливаем заголовки ответа для скачивания PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="analysis_report.pdf"'); // Имя файла, которое будет предложено пользователю при скачивании
        res.send(pdfBuffer); // Отправляем PDF-данные клиенту

    } catch (error) {
        console.error('Error converting HTML to PDF:', error);
        // Отправляем сообщение об ошибке, но закрываем браузер
        res.status(500).send(`Failed to convert HTML to PDF: ${error.message}`);
    } finally {
        // Всегда закрываем браузер, чтобы освободить ресурсы
        if (browser !== null) {
            await browser.close();
        }
    }
});

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`PDF Converter Service listening on port ${PORT}`);
});