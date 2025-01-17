import type { OIARequest } from './OIARequest.js';
import type { OIAWithholdings } from './OIAWithholdings.js';
import type { DatePartial } from './DatePartial.js';

export enum ProvenanceSource {
	NZ_POLICE = 'NZ Police',
}

export enum ProvenanceMethod {
	RELEASED_UNDER_THE_OIA = 'Released under the OIA',
	PROACTIVELY_RELEASED = 'Proactively released',
	LEAKED = 'Leaked',
}

export type Provenance = {
	source: ProvenanceSource,
	method: ProvenanceMethod,
	oiaRequest?: OIARequest,
	withholdings?: OIAWithholdings,
	published?: DatePartial,
	extracted?: DatePartial,
	released?: DatePartial,
	retrieved?: DatePartial,
	refused?: DatePartial,
	url?: string,
	archiveUrl?: string,
	fileUrl?: string,
	archiveFileUrl?: string,
};
