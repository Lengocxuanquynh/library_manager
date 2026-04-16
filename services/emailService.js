import emailjs from "@emailjs/browser";

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_68bbn1r";
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_7o9xnkc";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "Qx-1nf6mb5OF07OXU";

/**
 * Global centralized wrapper for EmailJS.
 * Checks for a DEV_MOCK_EMAIL bypass flag in localStorage to save quota.
 * 
 * @param targetEmail The recipient email
 * @param targetName The recipient name
 * @param contentData Can be a string (OTP code) OR an object mapping to EmailJS variables
 * @param customTemplateId (Optional) Use a different Template ID for things like Overdue Warnings
 */
export const sendMail = async (targetEmail, targetName, contentData, customTemplateId = null) => {
  if (typeof window !== "undefined") {
    const isMock = localStorage.getItem("DEV_MOCK_EMAIL") === "true";
    if (isMock) {
      const mockResult = typeof contentData === 'string' ? contentData : JSON.stringify(contentData);
      console.log(`[MOCK EMAIL] To: ${targetEmail}, Data: ${mockResult}`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ mock: true, otp: typeof contentData === 'string' ? contentData : 'Bypass', text: "Mock email sent" });
        }, 800); // Simulate network delay
      });
    }
  }

  // Khả năng tương thích ngược: Nếu contentData chỉ là chữ, hiểu ngầm nó là mã OTP
  const finalParams = typeof contentData === 'string' ? {
    to_email: targetEmail,
    name: targetName || "Thư Viện FPT",
    otp: contentData,
  } : {
    to_email: targetEmail,
    name: targetName || "Thư Viện FPT",
    ...contentData
  };

  const finalTemplateId = customTemplateId || TEMPLATE_ID;

  try {
    const response = await emailjs.send(
      SERVICE_ID,
      finalTemplateId,
      finalParams,
      {
        publicKey: PUBLIC_KEY,
      }
    );
    return { mock: false, response };
  } catch (error) {
    throw error;
  }
};
