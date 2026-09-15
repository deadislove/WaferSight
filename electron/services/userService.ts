import Database from "better-sqlite3-multiple-ciphers";
import bcrypt from 'bcryptjs';
import dbInstance from '../infra/db';
import { authService } from './authService';

export class UserService {
    private db:Database.Database;

    constructor(database = dbInstance) {
        this.db = database;
    }

    /**
     * Gets the full user list (admin only).
     */
    public getUsers(data: { token?: string }) {
        const authCheck = authService.verifyAdmin(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        try {
            const stmt = this.db.prepare(`
                SELECT id, username, role, security_question, created_at
                FROM users
                ORDER BY id DESC
            `);
            const users = stmt.all();

            return { success: true, data: users };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Creates a user (admin only).
     */
    public createUser(data: {
        token?: string;
        username: string;
        password: string;
        role?: string;
        securityQuestion: string;
        securityAnswer: string;
    }) {
        const authCheck = authService.verifyAdmin(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        const { username, password, securityQuestion, securityAnswer } = data;
        if (!username || !password || !securityQuestion || !securityAnswer) {
            return { success: false, error: '請完整填寫帳號、密碼、安全問題與答案' };
        }

        try {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const hashedAnswer = bcrypt.hashSync(securityAnswer.trim().toLowerCase(), 10);
            const role = data.role === 'admin' ? 'admin' : 'user';

            const stmt = this.db.prepare(`
                INSERT INTO users (username, password, security_question, security_answer, role)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(username, hashedPassword, securityQuestion, hashedAnswer, role);

            return { success: true };
        } catch (err: any) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return { success: false, error: '此帳號已被註冊' };
            }
            return { success: false, error: err.message };
        }
    }

    /**
     * Updates a user's role and/or resets their password (admin only).
     */
    public updateUser(data: { token?: string; id: number; role?: string; newPassword?: string }) {
        const authCheck = authService.verifyAdmin(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        try {
            const target: any = this.db.prepare('SELECT * FROM users WHERE id = ?').get(data.id);
            if (!target) {
                return { success: false, error: '找不到此使用者' };
            }

            if (data.role && data.role !== target.role) {
                if (target.role === 'admin' && data.role !== 'admin' && this.isLastAdmin(target.id)) {
                    return { success: false, error: '系統至少需保留一位管理員，無法變更此帳號權限' };
                }
                this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(data.role, data.id);
            }

            if (data.newPassword) {
                const hashedPassword = bcrypt.hashSync(data.newPassword, 10);
                this.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, data.id);
            }

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Deletes a user (admin only).
     */
    public deleteUser(data: { token?: string; id: number }) {
        const authCheck = authService.verifyAdmin(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        try {
            const target: any = this.db.prepare('SELECT * FROM users WHERE id = ?').get(data.id);
            if (!target) {
                return { success: false, error: '找不到此使用者' };
            }

            const decoded: any = authCheck.decoded;
            if (decoded.id === target.id) {
                return { success: false, error: '無法對自己的帳號執行此操作' };
            }

            if (target.role === 'admin' && this.isLastAdmin(target.id)) {
                return { success: false, error: '系統至少需保留一位管理員，無法刪除此帳號' };
            }

            this.db.prepare('DELETE FROM users WHERE id = ?').run(data.id);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Checks whether the given user is the system's last remaining admin.
     */
    private isLastAdmin(userId: number): boolean {
        const row: any = this.db
            .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND id != ?")
            .get(userId);
        return row.cnt === 0;
    }
}

export const userService = new UserService();