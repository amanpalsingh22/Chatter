import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let googleScriptPromise;
let initializedClientId = null;
let activeCredentialHandler = null;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    const script = existingScript || document.createElement("script");

    const handleLoad = () => resolve(window.google);
    const handleError = () => reject(new Error("Google Identity Services failed to load"));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    googleScriptPromise = undefined;
    throw error;
  });

  return googleScriptPromise;
};

const initializeGoogleIdentity = (clientId, credentialHandler) => {
  activeCredentialHandler = credentialHandler;

  if (initializedClientId === clientId) return;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => activeCredentialHandler?.(response),
  });
  initializedClientId = clientId;
};

const GoogleAuthButton = () => {
  const buttonContainerRef = useRef(null);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const { googleLogin, isGoogleLoggingIn } = useAuthStore();

  useEffect(() => {
    let isActive = true;

    const prepareGoogleButton = async () => {
      try {
        const [{ data: config }] = await Promise.all([
          axiosInstance.get("/auth/google/config"),
          loadGoogleIdentity(),
        ]);

        if (!isActive) return;

        if (!config.enabled || !config.clientId) {
          setIsAvailable(false);
          return;
        }

        const handleCredential = async (response) => {
          if (!response?.credential) {
            toast.error("Google did not return a sign-in credential");
            return;
          }

          await googleLogin(response.credential);
        };

        initializeGoogleIdentity(config.clientId, handleCredential);

        const container = buttonContainerRef.current;
        if (!container) return;

        container.replaceChildren();
        const width = Math.max(240, Math.min(Math.floor(container.clientWidth), 400));
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width,
        });
      } catch (error) {
        if (isActive) setIsAvailable(false);
        console.error("Unable to prepare Google sign-in", error);
      } finally {
        if (isActive) setIsPreparing(false);
      }
    };

    prepareGoogleButton();

    return () => {
      isActive = false;
      activeCredentialHandler = null;
    };
  }, [googleLogin]);

  return (
    <div className="relative min-h-10 w-full">
      <div
        ref={buttonContainerRef}
        className={`flex min-h-10 w-full justify-center ${
          isPreparing || !isAvailable || isGoogleLoggingIn ? "invisible" : ""
        }`}
      />

      {(isPreparing || !isAvailable || isGoogleLoggingIn) && (
        <div className="absolute inset-0">
          <button type="button" className="btn btn-outline w-full" disabled>
            {isGoogleLoggingIn ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Signing in with Google...
              </>
            ) : isPreparing ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Loading Google sign-in...
              </>
            ) : (
              "Google sign-in is unavailable"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleAuthButton;
