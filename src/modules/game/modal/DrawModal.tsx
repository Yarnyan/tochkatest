import Lottie from "lottie-react";
import SadAnimation from "../../../assets/lottie/Sad Emoji.json";

function DrawModal({
  isOpen,
  onRestart,
  onClose,
}: {
  isOpen: boolean;
  onRestart: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
        <div className="flex justify-center">
          <div className="w-32 h-32">
            <Lottie animationData={SadAnimation} loop={true} />
          </div>
        </div>
        <div className="p-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ничья!</h2>
          <p className="text-gray-600 mb-6">Хотите сыграть еще раз?</p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Закрыть
            </button>
            <button
              onClick={onRestart}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Новая игра
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrawModal;
