import type { Provenance } from './Provenance.js';
import type { Licence } from './Licence.js';
import type { Accessibility } from './Accessibility.js';
import type { Notice } from './Notice.js';

export enum PolicyVersionFileType {
	DOC = 'application/msword',
	PDF = 'application/pdf',
	TXT = 'text/plain',
}

export type PolicyVersionFile = {
	path: string,
	type: PolicyVersionFileType,
	startingPage?: number,
	size: number,
	provenance?: Provenance[],
	licence: Licence,
	original: boolean,
	incomplete?: boolean,
	modifications?: string[],
	accessibility: Accessibility,
	notices?: Notice[],
};