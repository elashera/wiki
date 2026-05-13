declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"docs": {
"en/01-networking-internet/01-what-is-internet.md": {
	id: "en/01-networking-internet/01-what-is-internet.md";
  slug: "en/01-networking-internet/01-what-is-internet";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/02-url-to-page-journey.md": {
	id: "en/01-networking-internet/02-url-to-page-journey.md";
  slug: "en/01-networking-internet/02-url-to-page-journey";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/03-dns-deep-dive.md": {
	id: "en/01-networking-internet/03-dns-deep-dive.md";
  slug: "en/01-networking-internet/03-dns-deep-dive";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/04-cloudflare-intro.md": {
	id: "en/01-networking-internet/04-cloudflare-intro.md";
  slug: "en/01-networking-internet/04-cloudflare-intro";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/05-http-deep-dive.md": {
	id: "en/01-networking-internet/05-http-deep-dive.md";
  slug: "en/01-networking-internet/05-http-deep-dive";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/06-status-codes.md": {
	id: "en/01-networking-internet/06-status-codes.md";
  slug: "en/01-networking-internet/06-status-codes";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/07-https-tls.md": {
	id: "en/01-networking-internet/07-https-tls.md";
  slug: "en/01-networking-internet/07-https-tls";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/08-lets-encrypt.md": {
	id: "en/01-networking-internet/08-lets-encrypt.md";
  slug: "en/01-networking-internet/08-lets-encrypt";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/09-cookies-sessions.md": {
	id: "en/01-networking-internet/09-cookies-sessions.md";
  slug: "en/01-networking-internet/09-cookies-sessions";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/10-authentication-api-keys-tokens.md": {
	id: "en/01-networking-internet/10-authentication-api-keys-tokens.md";
  slug: "en/01-networking-internet/10-authentication-api-keys-tokens";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/11-rest-api.md": {
	id: "en/01-networking-internet/11-rest-api.md";
  slug: "en/01-networking-internet/11-rest-api";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/12-ports.md": {
	id: "en/01-networking-internet/12-ports.md";
  slug: "en/01-networking-internet/12-ports";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/13-nat.md": {
	id: "en/01-networking-internet/13-nat.md";
  slug: "en/01-networking-internet/13-nat";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/14-servers-processes.md": {
	id: "en/01-networking-internet/14-servers-processes.md";
  slug: "en/01-networking-internet/14-servers-processes";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/15-osi-model-tcpip.md": {
	id: "en/01-networking-internet/15-osi-model-tcpip.md";
  slug: "en/01-networking-internet/15-osi-model-tcpip";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/16-routing-subnetting.md": {
	id: "en/01-networking-internet/16-routing-subnetting.md";
  slug: "en/01-networking-internet/16-routing-subnetting";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/17-firewalls-proxies-loadbalancers.md": {
	id: "en/01-networking-internet/17-firewalls-proxies-loadbalancers.md";
  slug: "en/01-networking-internet/17-firewalls-proxies-loadbalancers";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/18-messaging-protocols.md": {
	id: "en/01-networking-internet/18-messaging-protocols.md";
  slug: "en/01-networking-internet/18-messaging-protocols";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/19-cloudflare-complete.md": {
	id: "en/01-networking-internet/19-cloudflare-complete.md";
  slug: "en/01-networking-internet/19-cloudflare-complete";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/20-vps.md": {
	id: "en/01-networking-internet/20-vps.md";
  slug: "en/01-networking-internet/20-vps";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/01-networking-internet/21-cloud-providers.md": {
	id: "en/01-networking-internet/21-cloud-providers.md";
  slug: "en/01-networking-internet/21-cloud-providers";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"en/index.md": {
	id: "en/index.md";
  slug: "en";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/01-que-es-internet.md": {
	id: "es/01-redes-internet/01-que-es-internet.md";
  slug: "es/01-redes-internet/01-que-es-internet";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/02-como-navegar-de-url-a-pagina.md": {
	id: "es/01-redes-internet/02-como-navegar-de-url-a-pagina.md";
  slug: "es/01-redes-internet/02-como-navegar-de-url-a-pagina";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/03-dns-profundo.md": {
	id: "es/01-redes-internet/03-dns-profundo.md";
  slug: "es/01-redes-internet/03-dns-profundo";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/04-cloudflare-intro.md": {
	id: "es/01-redes-internet/04-cloudflare-intro.md";
  slug: "es/01-redes-internet/04-cloudflare-intro";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/05-http-profundo.md": {
	id: "es/01-redes-internet/05-http-profundo.md";
  slug: "es/01-redes-internet/05-http-profundo";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/06-status-codes.md": {
	id: "es/01-redes-internet/06-status-codes.md";
  slug: "es/01-redes-internet/06-status-codes";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/07-https-tls.md": {
	id: "es/01-redes-internet/07-https-tls.md";
  slug: "es/01-redes-internet/07-https-tls";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/08-lets-encrypt.md": {
	id: "es/01-redes-internet/08-lets-encrypt.md";
  slug: "es/01-redes-internet/08-lets-encrypt";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/09-cookies-sesiones.md": {
	id: "es/01-redes-internet/09-cookies-sesiones.md";
  slug: "es/01-redes-internet/09-cookies-sesiones";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/10-autenticacion-api-keys-tokens.md": {
	id: "es/01-redes-internet/10-autenticacion-api-keys-tokens.md";
  slug: "es/01-redes-internet/10-autenticacion-api-keys-tokens";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/11-api-rest.md": {
	id: "es/01-redes-internet/11-api-rest.md";
  slug: "es/01-redes-internet/11-api-rest";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/12-puertos.md": {
	id: "es/01-redes-internet/12-puertos.md";
  slug: "es/01-redes-internet/12-puertos";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/13-nat-red.md": {
	id: "es/01-redes-internet/13-nat-red.md";
  slug: "es/01-redes-internet/13-nat-red";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/14-servidores-procesos.md": {
	id: "es/01-redes-internet/14-servidores-procesos.md";
  slug: "es/01-redes-internet/14-servidores-procesos";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/15-modelo-osi-tcpip.md": {
	id: "es/01-redes-internet/15-modelo-osi-tcpip.md";
  slug: "es/01-redes-internet/15-modelo-osi-tcpip";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/16-routing-subnetting.md": {
	id: "es/01-redes-internet/16-routing-subnetting.md";
  slug: "es/01-redes-internet/16-routing-subnetting";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/17-firewalls-proxies-loadbalancers.md": {
	id: "es/01-redes-internet/17-firewalls-proxies-loadbalancers.md";
  slug: "es/01-redes-internet/17-firewalls-proxies-loadbalancers";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/18-protocolos-mensajeria.md": {
	id: "es/01-redes-internet/18-protocolos-mensajeria.md";
  slug: "es/01-redes-internet/18-protocolos-mensajeria";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/19-cloudflare-completo.md": {
	id: "es/01-redes-internet/19-cloudflare-completo.md";
  slug: "es/01-redes-internet/19-cloudflare-completo";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/20-vps.md": {
	id: "es/01-redes-internet/20-vps.md";
  slug: "es/01-redes-internet/20-vps";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/01-redes-internet/21-cloud-providers.md": {
	id: "es/01-redes-internet/21-cloud-providers.md";
  slug: "es/01-redes-internet/21-cloud-providers";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
"es/index.md": {
	id: "es/index.md";
  slug: "es";
  body: string;
  collection: "docs";
  data: any
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = never;
}
