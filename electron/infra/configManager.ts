import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import crypto from 'crypto';

interface AppConfig {
    dbEncryptionKey: string;
    jwtSecret: string;
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
    if (cachedConfig) return cachedConfig;

    // Config file path (e.g. C:\Users\xxx\AppData\Roaming\<AppName>\config.json)
    const configPath = path.join(app.getPath('userData'), 'config.json');

    try {
        if (fs.existsSync(configPath)) {
            const rawData = fs.readFileSync(configPath, 'utf-8');
            cachedConfig = JSON.parse(rawData);
        } else {
            // Doesn't exist yet — auto-generate strong random keys (32 bytes hex)
            cachedConfig = {
                dbEncryptionKey: crypto.randomBytes(32).toString('hex'),
                jwtSecret: crypto.randomBytes(64).toString('hex'),
            };

            // Ensure the directory exists, then write the config file
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(cachedConfig, null, 2), 'utf-8');
            
            console.log('[Security] Generated a new local security key file');
        }
    } catch (error) {
        console.error('[Security] Failed to read or create the config file, falling back to a temporary key', error);
        cachedConfig = {
            dbEncryptionKey: 'fallback-db-key',
            jwtSecret: 'fallback-jwt-secret',
        };
    }

    return cachedConfig!;
}