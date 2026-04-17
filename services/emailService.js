
const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_68bbn1r";
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_7o9xnkc";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "Qx-1nf6mb5OF07OXU";
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || ""; // Private key for server-side auth

/**
 * Global centralized wrapper for EmailJS.
 * Works on both Client-side (SDK) and Server-side (REST API).
 */
export const sendMail = async (targetEmail, targetName, contentData, customTemplateId = null) => {
  const isServer = typeof window === "undefined";

  // DEV MOCK logic
  if (!isServer) {
    const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";
    if (isMock) {
      console.log(`[MOCK EMAIL] To: ${targetEmail}, Data:`, contentData);
      const mockOtp = typeof contentData === 'string' ? contentData : (contentData?.otp || "000000");
      return { mock: true, text: "Mock email sent", otp: mockOtp };
    }
  }

  // Parameter Mapping
  const finalParams = typeof contentData === 'string' ? {
    to_email: targetEmail,
    name: targetName || "Độc giả",
    otp: contentData,
    message: contentData,
  } : {
    to_email: targetEmail,
    name: targetName || "Độc giả",
    ...contentData
  };

  const finalTemplateId = customTemplateId || TEMPLATE_ID;

  if (isServer) {
    // SERVER SIDE implementation: Use REST API
    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: SERVICE_ID,
          template_id: finalTemplateId,
          user_id: PUBLIC_KEY,
          template_params: finalParams,
          accessToken: PRIVATE_KEY
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`EmailJS Server-Side Error: ${errText}`);
      }
      return { mock: false, success: true };
    } catch (error) {
      console.error("EmailJS Server-Side Fetch Failed:", error);
      throw error;
    }
  } else {
    // CLIENT SIDE implementation: Use SDK
    try {
      // Dynamic import to avoid build errors with client-only modules
      const emailjs = (await import("@emailjs/browser")).default;
      
      const response = await emailjs.send(
        SERVICE_ID,
        finalTemplateId,
        finalParams,
        { publicKey: PUBLIC_KEY }
      );
      return { mock: false, response };
    } catch (error) {
      console.error("EmailJS Client-Side Send Failed:", error);
      throw error;
    }
  }
};
