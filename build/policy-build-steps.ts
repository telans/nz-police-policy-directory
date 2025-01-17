import type { PolicyBuildStep } from './BuildStep.js';

import CopyPlugin from 'copy-webpack-plugin';
import WriteFilePlugin from './util/write-file-plugin.js';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { htmlWebpackPluginTemplateCustomizer as TemplateCustomizer } from 'template-ejs-loader';

import { toUrlSegment } from './util/to-url-segment.js';
import { makeRootRelative } from './util/make-root-relative.js';
import * as paths from './util/paths.js';

import { FileDocumentType } from '../schema/File.js';

import type { File as PolicyFile } from '../schema/File.js';
import type { AlternateFile } from '../schema/AlternateFile.js';
import type { Policy } from '../schema/Policy.js';
import type { Version } from '../schema/PolicyVersion.js';
import { readFile } from 'fs/promises';
import { SiteData } from './util/get-site-data.js';
import { jsonClone } from './util/json-clone.js';

/**
 * Build steps for a particular policy.
 */
export const policyBuildSteps: Record<string, PolicyBuildStep> = {
	/**
	 * Copy the metadata file for a policy to its destination
	 */
	copyMetadata(src, dst) {
		return [new CopyPlugin({
			patterns: [{ from: `${src}/metadata.json`, to: `${dst}.json` }],
		})];
	},

	/**
	 * Copy all files for a policy to their destinations
	 */
	copyFiles(src, dst, buildData) {
		const { policy } = buildData;

		const plugins: CopyPlugin[] = [];

		function copyFile(file: PolicyFile | AlternateFile, version: Version) {
			const fileSrcPathAndName = `${src}/${file.path}`;
			const fileDst = getFileDst(dst, file, version);

			plugins.push(
				new CopyPlugin({
					patterns: [{ from: fileSrcPathAndName, to: fileDst }],
				})
			);

			// Update file.path to ensure the build HTML points to the correct place
			makeFilePathRootRelative(dst, file, version);
		}

		for (const version of policy.versions) {
			for (const file of version.files) {
				copyFile(file, version);

				if (file.alternateFiles) {
					for (const altFile of file.alternateFiles) {
						if (altFile.type !== 'text/html') {
							copyFile(altFile, version);
						}
					}
				}
			}
		}

		return plugins;
	},

	/**
	 * Build any HTML-based alternate files
	 */
	async createHtmlAlternateFiles(src, dst, buildData) {
		const {
			siteData,
			policy,
		} = buildData;

		const plugins: HtmlWebpackPlugin[] = [];

		for (const version of policy.versions) {
			for (const parentFile of version.files) {
				if (parentFile.alternateFiles) {
					for (const file of parentFile.alternateFiles) {
						if (file.type === 'text/html') {
							const fileDst = getFileDst(dst, file, version);

							const documentBuffer = await readFile(`${src}/${file.path}`);
							const document = documentBuffer.toString();

							plugins.push(new HtmlWebpackPlugin({
								filename: `${fileDst}`,
								template: TemplateCustomizer({
									htmlLoaderOption: {
										sources: false,
									},
									templatePath: `${paths.templates}/pages/document.ejs`,
									templateEjsLoaderOption: {
										data: {
											siteData,
											pageData: {
												document,
												parentFile,
												version,
												policy,
											},
										},
									},
								}),
								chunks: ['priority', 'main', 'enhancements', 'style-document'],
							}));

							// Update file.path to ensure the build HTML points to the correct place
							makeFilePathRootRelative(dst, file, version);
						}
					}
				}
			}
		}

		return plugins;
	},

	/**
	 * Generate the HTML for a Policy page
	 */
	createPolicyPage(src, dst, buildData) {
		const { policy } = buildData;

		const {
			siteData,
			...basePageData
		} = buildData;

		const versionPaths: Record<string, string> = {};
		for (const version of policy.versions) {
			versionPaths[version.id] = createVersionDstPath('.', version);
		}

		const pageData = {
			...basePageData,
			versionPaths,
		};

		return [new HtmlWebpackPlugin({
			filename: `${dst}/index.html`,
			template: TemplateCustomizer({
				htmlLoaderOption: {
					sources: false,
				},
				templatePath: `${paths.templates}/pages/policy.ejs`,
				templateEjsLoaderOption: {
					data: {
						siteData,
						pageData,
					},
				},
			}),
			chunks: ['priority', 'main', 'enhancements', 'style'],
		})];
	},

	/**
	 * Construct and copy all version metadata to its destination
	 */
	createVersionMetadata(src, dst, buildData) {
		const { policy } = buildData;

		const plugins: ReturnType<PolicyBuildStep> = [];

		for (const version of policy.versions) {
			plugins.push(createVersionMetadata(dst, policy, version));
		}

		const latest = policy.versions.find((version) => {
			return version.files.some((file) => {
				return file.documentType === FileDocumentType.POLICY && file.incomplete?.value !== true;
			});
		});

		if (latest) {
			plugins.push(createVersionMetadata(dst, policy, latest, true));
		}

		return plugins;
	},

	/**
	 * Generate a page for each version of the policy
	 */
	createVersionPages(src, dst, buildData) {
		const {
			siteData,
			policy,
		} = buildData;

		const plugins: ReturnType<PolicyBuildStep> = [];

		for (const version of policy.versions) {
			plugins.push(createVersionPlugin(siteData, dst, policy, version));
		}

		const latest = policy.versions.find((version) => {
			return version.files.some((file) => {
				return file.documentType === FileDocumentType.POLICY && file.incomplete?.value !== true;
			});
		});

		if (latest) {
			plugins.push(createVersionPlugin(siteData, dst, policy, latest, true));
		}

		return plugins;
	},
};

/**
 * Create a root-relative path for a file, and save it over its `path` property
 */
function makeFilePathRootRelative(
	dst: string,
	file: PolicyFile | AlternateFile,
	version: Version,
) {
	const fileDst = getFileDst(dst, file, version);
	const fileDstRootRelative = makeRootRelative(fileDst);
	file.path = fileDstRootRelative;
}

/**
 * Construct the dst path for a file, based on its version
 */
function getFileDst(
	dst: string,
	file: PolicyFile | AlternateFile,
	version: Version,
) {
	const versionUrlKey = version.name || version.id;
	const versionUrl = toUrlSegment(versionUrlKey);

	const fileName = file.path.replace(/.*\//, '');
	const fileDstPath = versionUrl;
	const fileDstPathAndName = `${dst}/${fileDstPath}/${fileName}`;

	return fileDstPathAndName;
}

/**
 * Construct the destination path for a version based off its name or ID
 */
function createVersionDstPath(dst: string, version: Version): string {
	const versionUrlKey = version.name || version.id;
	const versionPathName = toUrlSegment(versionUrlKey);
	const versionDst = `${dst}/${versionPathName}`;

	return versionDst;
}

function createVersionMetadata(
	dst: string,
	policy: Policy,
	version: Version,
	latest: boolean = false,
) {
	// Construct destination path
	const versionDst = createVersionDstPath(dst, version);

	// Construct a version of this policy with only the current version
	const versionId = version.id;
	const singleVersionPolicy = jsonClone(policy);
	singleVersionPolicy.versions = singleVersionPolicy.versions.filter(
		(version) => version.id === versionId
	);

	return new WriteFilePlugin(
		`${latest ? `${dst}/latest` : versionDst}.json`,
		JSON.stringify(singleVersionPolicy, null, '\t'),
	);
}

function createVersionPlugin(
	siteData: SiteData,
	dst: string,
	policy: Policy,
	version: Version,
	latest: boolean = false,
): HtmlWebpackPlugin {
	const versionDst = createVersionDstPath(dst, version);
	const pageData = {
		policy,
		version,
		latest,
		versionDst,
	};

	return new HtmlWebpackPlugin({
		filename: latest ? `${dst}/latest/index.html` : `${versionDst}/index.html`,
		template: TemplateCustomizer({
			htmlLoaderOption: {
				sources: false,
			},
			templatePath: `${paths.templates}/pages/version.ejs`,
			templateEjsLoaderOption: {
				data: {
					siteData,
					pageData,
				},
			},
		}),
		chunks: ['priority', 'main', 'enhancements', 'style'],
	});
}
