import { createApp } from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faBookmark,
  faCheck,
  faCheckDouble,
  faComments,
  faEllipsisVertical,
  faFileLines,
  faImage,
  faMagnifyingGlass,
  faMinus,
  faPaperPlane,
  faPaperclip,
  faPhone,
  faRightFromBracket,
  faUsers,
  faUserPlus,
  faVolumeXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { faSquare } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import App from "./App.vue";

library.add(
  faBookmark,
  faCheck,
  faCheckDouble,
  faComments,
  faEllipsisVertical,
  faFileLines,
  faImage,
  faMagnifyingGlass,
  faMinus,
  faPaperPlane,
  faPaperclip,
  faPhone,
  faRightFromBracket,
  faSquare,
  faUsers,
  faUserPlus,
  faVolumeXmark,
  faXmark,
);

createApp(App).component("FontAwesomeIcon", FontAwesomeIcon).mount("#app");
