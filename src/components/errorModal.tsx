import { useTranslation } from 'react-i18next';
import Modal from './modal';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
}

export default function ErrorModal({ isOpen, onClose, title, message }: ErrorModalProps) {
    const { t } = useTranslation();
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title ?? t('errorModal.defaultTitle')}>
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                    <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-gray-800 font-medium">{message}</p>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}