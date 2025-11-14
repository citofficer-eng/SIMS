# Dockerfile for SIMS PHP Backend on Cloud Run
# Supports PHP 8.2 with Apache, Composer dependencies, and environment configuration

FROM php:8.2-apache

# Set working directory
WORKDIR /var/www/html

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    && docker-php-ext-install pdo pdo_mysql \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache mod_rewrite for routing
RUN a2enmod rewrite

# Copy composer files
COPY composer.json composer.lock* ./

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-progress --no-interaction

# Copy entire project (config, api, vendor will be included)
COPY . .

# Copy Apache configuration to enable .htaccess and clean URLs
COPY --chown=www-data:www-data . /var/www/html/

# Configure Apache VirtualHost for routing API requests
RUN echo '<VirtualHost *:8080>\n\
    ServerName _\n\
    DocumentRoot /var/www/html\n\
    <Directory /var/www/html>\n\
        AllowOverride All\n\
        Order allow,deny\n\
        Allow from all\n\
    </Directory>\n\
    ErrorLog ${APACHE_LOG_DIR}/error.log\n\
    CustomLog ${APACHE_LOG_DIR}/access.log combined\n\
</VirtualHost>' > /etc/apache2/sites-available/000-default.conf

# Expose port 8080 (Cloud Run requirement)
EXPOSE 8080

# Set environment for Cloud Run (listens on 8080)
ENV APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    APACHE_LOG_DIR=/var/log/apache2 \
    APACHE_PID_FILE=/var/run/apache2/apache2.pid

# Run Apache in foreground
CMD ["apache2-foreground"]
