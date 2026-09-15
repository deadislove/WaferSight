import { net } from 'electron';

interface RegisteredNetworkTask {
    fn: (ctx: { hasInternet: boolean }) => void | Promise<void>;
}

const registeredTasks: RegisteredNetworkTask[] = [];

async function checkInternetAccess(): Promise<boolean> {
    try {
        const response = await net.fetch('https://www.google.com', { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

export function registerNetworkBackgroundWorker(task: (ctx: { hasInternet: boolean }) => void | Promise<void>) {
    registeredTasks.push({ fn: task });
}

export function startNetworkBackgroundWorker() {
    setInterval(async () => {
        const hasInternet = await checkInternetAccess();
        for (const task of registeredTasks) {
            try {
                await task.fn({ hasInternet });
            } catch (error) {
                console.error('[Network Background Worker task error]', error);
            }
        }
    }, 30000);
}
