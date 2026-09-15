import db from '../infra/db';

interface RegisteredTask {
    fn: () => void | Promise<void>;
}

let registeredTasks: RegisteredTask[] = [];


export function registerBackgroundWorker(task: () => void | Promise<void>) {
    registeredTasks.push({ fn: task });
}


export function startBackgroundWorker() {
    setInterval(async () => {
        for (const task of registeredTasks) {
            try {
                await task.fn();
            } catch (error) {
                console.error('[Background Worker task error]', error);
            }
        }
    }, 30000);
}

export function checkingDb() {
    console.log('--- Running background database check ---');
    try {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
        const result = stmt.get() as { count: number };
        console.log(`Current total user count: ${result.count}`);
    } catch (err) {
        console.error('Background database check failed:', err);
    }
}
