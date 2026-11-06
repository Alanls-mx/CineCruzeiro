((root) => {
  function createTicketQrReader({ state, $, window, document, navigator, location, QR_SCAN_DURATION_MS, BarcodeDetector, escapeHtml, showToast, validateTicketByCode, renderTicketValidationResult }) {
    async function startQrReader() {
      stopQrReader();
      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) {
        renderTicketValidationResult("invalid", { message: "A câmera exige HTTPS em produção. Digite o código manualmente." });
        $("manualCodeBox").hidden = false;
        $("validateTicketButton").hidden = false;
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        renderTicketValidationResult("invalid", { message: "Este navegador não oferece câmera web. Digite o código manualmente." });
        $("manualCodeBox").hidden = false;
        $("validateTicketButton").hidden = false;
        return;
      }
      try {
        state.qrCameraPermission = "prompt";
        setQrReaderActive(true, "Solicitando permissão da câmera...");
        state.qrStream = await requestCameraStream();
        state.qrCameraPermission = "granted";
        const video = $("qrVideo");
        await prepareQrVideo(video, state.qrStream);
        state.qrTorchTrack = state.qrStream.getVideoTracks()[0] || null;
        await state.qrTorchTrack?.applyConstraints?.({ advanced: [{ focusMode: "continuous" }] }).catch(() => null);
        const cameraLabel = String(state.qrTorchTrack?.label || "").trim();
        setQrReaderActive(true, cameraLabel ? `Câmera ativa: ${cameraLabel}` : "Aponte para o QR Code");
        let detector = null;
        if ("BarcodeDetector" in window) {
          try {
            detector = new BarcodeDetector({ formats: ["qr_code"] });
          } catch {
            detector = null;
          }
        }
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        state.qrScanDeadline = Date.now() + QR_SCAN_DURATION_MS;
        updateQrCountdown();
        state.qrCountdownTimer = setInterval(updateQrCountdown, 250);
        state.qrCloseTimer = setTimeout(() => {
          stopQrReader("Tempo de leitura encerrado. Abra a camera novamente ou digite o codigo manualmente.");
        }, QR_SCAN_DURATION_MS);
        $("ticketValidationResult").className = "validation-result scanner-ready";
        $("ticketValidationResult").textContent = detector
          ? "Leitura automática ativa."
          : "Leitura alternativa ativa via jsQR.";

        state.qrScanTimer = setInterval(async () => {
          if (!video.videoWidth || state.qrValidationLocked) return;

          let value = "";
          try {
            if (detector) {
              const codes = await detector.detect(video).catch(() => []);
              value = codes[0]?.rawValue || "";
            }
            if (!value && window.jsQR && context) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              value = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" })?.data || "";
            }
          } catch {
            // Uma falha isolada de leitura nao deve encerrar a camera.
          }

          const now = Date.now();
          if (value && (value !== state.qrLastValue || now - state.qrLastValueAt > 3000)) {
            state.qrLastValue = value;
            state.qrLastValueAt = now;
            if ($("ticketValidationCode")) $("ticketValidationCode").value = value;
            stopQrReader(state.validationMode === "concessions" ? "QR Code lido. Conferindo bomboniere..." : "QR Code lido. Validando ingresso...");
            validateTicketByCode(value, { autoRestart: true });
          }
        }, 420);
      } catch (error) {
        stopQrReader();
        state.qrCameraPermission = await getCameraPermissionState();
        renderCameraAccessError(error, state.qrCameraPermission);
        $("manualCodeBox").hidden = false;
        $("validateTicketButton").hidden = false;
      }
    }

    async function getCameraPermissionState() {
      if (!navigator.permissions?.query) return "unknown";
      try {
        const permission = await navigator.permissions.query({ name: "camera" });
        return permission.state || "unknown";
      } catch {
        return "unknown";
      }
    }

    async function requestCameraStream() {
      const attempts = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        },
        {
          video: {
            facingMode: "environment"
          },
          audio: false
        },
        {
          video: true,
          audio: false
        }
      ];
      let lastError = null;
      for (const constraints of attempts) {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
          lastError = error;
          if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(error?.name)) throw error;
        }
      }
      throw lastError || new Error("Camera unavailable");
    }

    async function prepareQrVideo(video, stream) {
      if (!video) throw new Error("Video do leitor nao encontrado.");
      video.muted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.srcObject = stream;
      try {
        if (!video.videoWidth) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("A câmera demorou para iniciar.")), 7000);
            if (video.readyState >= 1) {
              clearTimeout(timeout);
              resolve();
              return;
            }
            video.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve();
            };
            video.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Não foi possível carregar a prévia da câmera."));
            };
          });
        }
        await video.play();
        await new Promise((resolve, reject) => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
            return;
          }
          const timeout = setTimeout(() => reject(new Error("A câmera abriu, mas não enviou imagem.")), 5000);
          video.addEventListener("playing", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        throw error;
      }
    }

    function cameraRecoverySteps(permissionState = "unknown") {
      if (permissionState === "denied") {
        return [
          "Clique no cadeado ao lado do endereço do site.",
          "Altere Câmera para Permitir.",
          "Feche este aviso e toque em Solicitar acesso novamente."
        ];
      }
      return [
        "Confira se outro aplicativo não está usando a câmera.",
        "Toque em Solicitar acesso novamente para o navegador abrir a permissão.",
        "Se preferir, valide pelo código manual do ingresso."
      ];
    }

    function renderCameraAccessError(error, permissionState = "unknown") {
      const target = $("ticketValidationResult");
      const errorName = String(error?.name || "");
      const blocked = permissionState === "denied" || ["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(errorName);
      const unavailable = ["NotFoundError", "DevicesNotFoundError"].includes(errorName);
      const busy = ["NotReadableError", "TrackStartError", "AbortError"].includes(errorName);
      let title = "Não foi possível abrir a câmera";
      let message = "Feche outros aplicativos que usam a câmera e tente novamente.";
      let help = "Você também pode digitar o código do ingresso abaixo.";

      if (blocked) {
        title = "Permissão da câmera bloqueada";
        message = "Libere a câmera nas permissões deste site e tente novamente.";
        help = "No computador, use o cadeado ao lado do endereço. No celular, abra as permissões do navegador ou do site e selecione Câmera: Permitir.";
      } else if (unavailable) {
        title = "Nenhuma câmera encontrada";
        message = "Conecte ou ative uma câmera neste dispositivo.";
      } else if (busy) {
        title = "Câmera em uso por outro aplicativo";
        message = "Feche a câmera, videochamada ou outro leitor aberto e tente novamente.";
      }
      const steps = cameraRecoverySteps(permissionState);

      if (!target) return;
      target.className = "validation-result camera-access-result";
      target.innerHTML = `
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(message)}</p>
        <span>${escapeHtml(help)}</span>
        <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        <button class="primary-button" type="button" data-camera-retry>Solicitar acesso novamente</button>
      `;
      target.querySelector("[data-camera-retry]")?.addEventListener("click", startQrReader);
      const startButton = $("startQrButton");
      if (startButton) startButton.textContent = "Solicitar câmera";
    }

    function updateQrCountdown() {
      const seconds = Math.max(0, Math.ceil((state.qrScanDeadline - Date.now()) / 1000));
      const counter = $("qrCountdown");
      if (counter) counter.textContent = `${seconds}s`;
    }

    function setQrReaderActive(active, status = "") {
      const frame = $("qrReaderFrame");
      if (frame) frame.classList.toggle("active", active);
      const startButton = $("startQrButton");
      const stopButton = $("stopQrButton");
      if (startButton) {
        startButton.disabled = active;
        if (active) startButton.textContent = "Abrindo câmera...";
        else if (state.qrCameraPermission === "granted") startButton.textContent = "Abrir câmera";
      }
      if (stopButton) stopButton.disabled = !active;
      const torchButton = $("torchQrButton");
      const hasTorch = Boolean(state.qrTorchTrack?.getCapabilities?.().torch);
      if (torchButton) {
        torchButton.disabled = !active || !hasTorch;
        torchButton.classList.toggle("active", state.qrTorchOn);
      }
      const statusElement = $("qrReaderStatus");
      if (statusElement) statusElement.textContent = status || (active ? "Câmera ativa" : "Câmera desligada");
      const counter = $("qrCountdown");
      if (counter && !active) counter.textContent = "30s";
    }

    function stopQrReader(message = "") {
      clearTimeout(state.qrAutoRestartTimer);
      if (state.qrScanTimer) {
        clearInterval(state.qrScanTimer);
        state.qrScanTimer = null;
      }
      if (state.qrCloseTimer) {
        clearTimeout(state.qrCloseTimer);
        state.qrCloseTimer = null;
      }
      if (state.qrCountdownTimer) {
        clearInterval(state.qrCountdownTimer);
        state.qrCountdownTimer = null;
      }
      state.qrScanDeadline = 0;
      state.qrTorchOn = false;
      state.qrTorchTrack = null;
      if (state.qrStream) {
        state.qrStream.getTracks().forEach((track) => track.stop());
        state.qrStream = null;
      }
      const video = $("qrVideo");
      if (video) video.srcObject = null;
      setQrReaderActive(false, message || "Câmera desligada");
      if (message && $("ticketValidationResult")) {
        $("ticketValidationResult").className = "validation-result";
        $("ticketValidationResult").textContent = message;
      }
    }

    async function toggleQrTorch() {
      const track = state.qrTorchTrack;
      if (!track?.getCapabilities?.().torch) return;
      state.qrTorchOn = !state.qrTorchOn;
      await track.applyConstraints({ advanced: [{ torch: state.qrTorchOn }] }).catch(() => {
        state.qrTorchOn = false;
        showToast("Lanterna indisponível neste aparelho.", "error");
      });
      setQrReaderActive(Boolean(state.qrStream), state.qrStream ? "Aponte para o QR Code" : "Câmera desligada");
    }

    function toggleManualCodeBox() {
      const box = $("manualCodeBox");
      const button = $("validateTicketButton");
      if (!box || !button) return;
      const nextHidden = !box.hidden;
      box.hidden = nextHidden;
      button.hidden = nextHidden;
      if (!nextHidden) $("ticketValidationCode")?.focus();
    }

    function scanNextTicket() {
      if ($("ticketValidationCode")) $("ticketValidationCode").value = "";
      state.qrLastValue = "";
      state.qrLastValueAt = 0;
      state.qrPendingEntryCode = "";
      state.qrPendingConcessionCode = "";
      if ($("ticketValidationResult")) {
        $("ticketValidationResult").className = "validation-result scanner-ready";
        $("ticketValidationResult").textContent = state.validationMode === "concessions"
          ? "Pronto para conferir o próximo pedido da bomboniere."
          : "Pronto para o próximo ingresso.";
      }
      startQrReader();
    }

    return { startQrReader, getCameraPermissionState, requestCameraStream, prepareQrVideo, cameraRecoverySteps, renderCameraAccessError, updateQrCountdown, setQrReaderActive, stopQrReader, toggleQrTorch, toggleManualCodeBox, scanNextTicket };
  }
  const api = Object.freeze({ createTicketQrReader });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.ticketQrReader = api; }
})(globalThis);
