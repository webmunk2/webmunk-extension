type RateResponses = {
  relevance: string | null;
  distraction: string | null;
}

export class RateService {
  private responses: RateResponses;

  constructor() {
    this.responses = { relevance: null, distraction: null };
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    if (message.action === 'extensionAds.rateService.adRatingRequest') {
      this.showAdRatingNotification();
    }
  }

  private showAdRatingNotification(): void {
    if (document.getElementById('webmunk-notification')) return;

    const styles = document.createElement('style');
    styles.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');

      .notification-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 10000;

        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;

        pointer-events: none;
      }

      .notification-container {
        position: fixed;
        z-index: 10000;

        display: flex;
        flex-direction: column;
        gap: 15px;
        width: 410px;
        padding: 15px 20px;

        background-color: #ffffff;
        border: 1px solid transparent;
        color: black;
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 700 !important;
        border-radius: 10px;
        opacity: 0;
        box-shadow:  0 0 10px rgba(0,0,0,0.2);
        animation: appear 0.5s linear forwards;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        pointer-events: all;
      }

      .notification-disappear {
        animation: disappear 0.5s linear forwards;
      }

      @keyframes disappear {
        0% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      @keyframes appear {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }

      input {
        appearance: unset;
      }

      .star {
        transition: color 0.3s;
        color: lightgray;
      }

      .star:before {
        content: '\\2605';
        font-size: 30px;
        cursor: pointer;
      }

      input:checked ~ .star,
      .star:hover,
      .star:hover ~ .star {
        color: orange;
        transition: color 0.3s;
      }

      input:checked ~ .star {
        transition: 0s;
        animation: scale 0.75s backwards;
      }

      @keyframes scale {
        0% {
          transform: scale(1);
        }

        30% {
          transform: scale(0);
        }

        60% {
          transform: scale(1.2);
        }
      }

      .close-button {
        background-color: transparent;
        cursor: pointer;
        fill: rgb(175, 175, 175);

        &:hover {
          fill: black;
        }
      }

      .response-btn {
        padding: 10px 20px;
        width: 70px;
        height: 35px;
        display: flex;
        justify-content: center;
        align-items: center;

        border: 2px solid black;
        color: black;
        background-color: white;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.3s, color 0.3s;
        border-radius: 20px;
      }

      .response-btn.active {
        background-color: black;
        color: white;
        border-color: black;
      }

      .response-btn:hover:not(.active) {
        background-color: #f0f0f0;
      }
    `;

    document.head.appendChild(styles);
    const wrapper = document.createElement('div');
    wrapper.classList.add('notification-wrapper');
    wrapper.id = 'webmunk-notification';

    const notificationContainer = document.createElement('div');
    notificationContainer.classList.add('notification-container');

    const notificationContent = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img style="width: 25px; height: 25px;" src="${chrome.runtime.getURL('images/favicon.png')}" alt="logo">
          <p style="font-size: 20px; color: black; margin: 0; line-height: 1.3;">Ad Study Survey</p>
        </div>
        <svg id="close-button" class="close-button" height="20px" viewBox="0 0 384 512">
          <path
            d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"
          >
          </path>
        </svg>
      </div>
      <div style="display: flex; gap: 10px; flex-direction: column;">
        <p style="font-size: 18px; color: black; margin: 0; line-height: 1.3;">Are these ads on this site relevant to you?</p>
        <div class="response-buttons" style="display: flex; align-items: center; gap: 15px; justify-content: center;">
          <button class="response-btn" data-question="relevance">Yes</button>
          <button class="response-btn" data-question="relevance">No</button>
        </div>
      </div>
      <div style="display: flex; gap: 10px; flex-direction: column;">
        <p style="font-size: 18px; color: black; margin: 0; line-height: 1.3;"> Do the ads on this site distract you?</p>
        <div class="response-buttons" style="display: flex; align-items: center; gap: 15px; justify-content: center;">
          <button class="response-btn" data-question="distraction">Yes</button>
          <button class="response-btn" data-question="distraction">No</button>
        </div>
      </div>
    `;

    notificationContainer.innerHTML = notificationContent;
    wrapper.appendChild(notificationContainer);
    document.documentElement.appendChild(wrapper);

    document.getElementById('close-button')!.addEventListener('click', () => {
      this.sendResponseToService('skip');
      notificationContainer.classList.add('notification-disappear');

      setTimeout(() => {
        notificationContainer.remove();
      }, 1000)
    });

    document.querySelectorAll('.response-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const question = target.dataset.question;
        const answer = target.textContent;

        this.responses[question as keyof RateResponses] = answer;

        document.querySelectorAll(`.response-btn[data-question="${question}"]`).forEach((btn) => {
          btn.classList.remove('active');
        });

        target.classList.add('active');

        if (this.responses?.relevance && this.responses?.distraction) {
          this.sendResponseToService(this.responses);
          notificationContainer.classList.add('notification-disappear');
          setTimeout(() => notificationContainer.remove(), 2000);
        }
      });
    });
  }

  private sendResponseToService(response: RateResponses | string): void {
    chrome.runtime.sendMessage({
      action: 'extensionAds.rateService.adRatingResponse',
      response
    });
  }
}
