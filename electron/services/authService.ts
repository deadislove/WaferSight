import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3-multiple-ciphers';
import dbInstance from '../infra/db';
import { getAppConfig } from '../infra/configManager';
import { getErrorMessage } from '../infra/errorMessage';

export interface TokenPayload {
    id: number;
    username: string;
    role: string;
}

interface UserRow {
    id: number;
    username: string;
    password: string;
    security_question: string;
    security_answer: string;
    role: string;
}

export class AuthService {
    private db: Database.Database;
    private jwtSecret: string;

    constructor(database = dbInstance, secret?: string) {
        this.db = database;
        const config = getAppConfig();
        this.jwtSecret = secret || config.jwtSecret;
    }

    /**
     * Gets the JWT secret (public method, callable from elsewhere if needed).
     */
    public getJwtSecret(): string {
        return this.jwtSecret;
    }

    /**
     * Verifies whether a token is valid (was originally a plain function, now a class method).
     */
    public verifyToken(token?: string) {
        if (!token) return { valid: false, error: '未提供 Token' };
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
            return { valid: true, decoded };
        } catch {
            return { valid: false, error: 'Token 無效或已過期' };
        }
    }

    /**
     * Verifies the token is valid AND the user's current role in the
     * database is admin (checks the role as it stands in the DB right now,
     * not the role frozen into the token at sign time).
     */
    public verifyAdmin(token?: string) {
        const check = this.verifyToken(token);
        if (!check.valid) return { valid: false, error: check.error };

        try {
            const decoded = check.decoded as TokenPayload;
            const stmt = this.db.prepare('SELECT role FROM users WHERE id = ?');
            const row = stmt.get(decoded.id) as { role: string } | undefined;

            if (!row || row.role !== 'admin') {
                return { valid: false, error: '權限不足，僅限管理員操作' };
            }

            return { valid: true, decoded };
        } catch (err) {
            return { valid: false, error: getErrorMessage(err) };
        }
    }

    /**
     * Handles user registration.
     */
    public register(data: { username: string; password: string; securityQuestion: string; securityAnswer: string }) {
        const { username, password, securityQuestion, securityAnswer } = data;

        if (!username || !password || !securityQuestion || !securityAnswer) {
            return { success: false, error: '請完整填寫帳號、密碼、安全問題與答案' };
        }

        try {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const hashedAnswer = bcrypt.hashSync(securityAnswer.trim().toLowerCase(), 10);

            const stmt = this.db.prepare(
                'INSERT INTO users (username, password, security_question, security_answer) VALUES (?, ?, ?, ?)'
            );
            stmt.run(username, hashedPassword, securityQuestion, hashedAnswer);
            return { success: true };
        } catch (err) {
            const message = getErrorMessage(err);
            if (message?.includes('UNIQUE constraint failed')) {
                return { success: false, error: '此帳號已被註冊' };
            }
            return { success: false, error: message };
        }
    }

    /**
     * Handles user login.
     */
    public login(data: { username: string; password: string }) {
        const { username, password } = data;

        try {
            const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
            const user = stmt.get(username) as UserRow | undefined;

            if (!user || !bcrypt.compareSync(password, user.password)) {
                return { success: false, error: '帳號或密碼錯誤' };
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                this.jwtSecret,
                { expiresIn: '1d' }
            );

            return {
                success: true,
                token,
                user: { id: user.id, username: user.username, role: user.role }
            };
        } catch (err) {
            return { success: false, error: getErrorMessage(err) };
        }
    }

    /**
     * Gets the security question (step 1 of forgot-password).
     */
    public getSecurityQuestion(username: string) {
        if (!username) {
            return { success: false, error: '請輸入帳號' };
        }
        try {
            const stmt = this.db.prepare('SELECT security_question FROM users WHERE username = ?');
            const user = stmt.get(username) as Pick<UserRow, 'security_question'> | undefined;

            if (!user) {
                return { success: false, error: '找不到此帳號' };
            }

            return { success: true, question: user.security_question };
        } catch (err) {
            return { success: false, error: getErrorMessage(err) };
        }
    }

    /**
     * Resets the password (step 2 of forgot-password).
     */
    public resetPassword(data: { username: string; securityAnswer: string; newPassword: string }) {
        const { username, securityAnswer, newPassword } = data;

        try {
            const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
            const user = stmt.get(username) as UserRow | undefined;

            if (!user) {
                return { success: false, error: '找不到此帳號' };
            }

            const isAnswerCorrect = bcrypt.compareSync(securityAnswer.trim().toLowerCase(), user.security_answer);
            if (!isAnswerCorrect) {
                return { success: false, error: '安全提問答案錯誤' };
            }

            const newHashedPassword = bcrypt.hashSync(newPassword, 10);
            const updateStmt = this.db.prepare('UPDATE users SET password = ? WHERE id = ?');
            updateStmt.run(newHashedPassword, user.id);

            return { success: true };
        } catch (err) {
            return { success: false, error: getErrorMessage(err) };
        }
    }
}

// A default singleton export, so it's just as easy to use from outside as a plain function.
export const authService = new AuthService();