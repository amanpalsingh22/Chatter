import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedChat } = useChatStore();

  return (
    <div className="h-dvh bg-base-200 pt-16">
      <main className="h-full w-full p-2 sm:p-3 lg:p-4">
        <div className="h-full w-full min-h-0 min-w-0 rounded-lg bg-base-100 shadow-xl">
          <div className="flex h-full min-h-0 min-w-0 overflow-hidden rounded-lg">
            {!selectedChat && <Sidebar />}

            {!selectedChat ? (
              <div className="hidden min-w-0 flex-1 md:flex">
                <NoChatSelected />
              </div>
            ) : (
              <>
                <div className="hidden md:flex">
                  <Sidebar />
                </div>
                <ChatContainer />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
export default HomePage;
