import { installPortableContentHandlers } from '../../dom/portableContentHandlers';
import { installPortableInteractionController } from '../../dom/portableInteractionController';

installPortableContentHandlers(document, window);
installPortableInteractionController(document, window);
