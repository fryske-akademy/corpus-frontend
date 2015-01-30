<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:tei="http://www.tei-c.org/ns/1.0" exclude-result-prefixes="tei">
	<xsl:output encoding="utf-8" method="html" omit-xml-declaration="yes" />
	<xsl:param name="title_name" select="'#'"/>
	<xsl:param name="source_images" select="''"/>

	<xsl:template match="error">
		<h1>Error</h1>
        <xsl:value-of select="message" />
        (Error code: <xsl:value-of select="code" />)
	</xsl:template>
	
	<xsl:template match="docPid|docFields" />
	
	<xsl:template match="docInfo">
		<div class="span12 contentbox">
			<h2>
				<xsl:value-of select="*[name()=$title_name]" />
			</h2>
			<div class="span10">
				<div class="span2">
					<i>Hits in document:</i>
				</div>
				<div class="span7" id="divHitsInDocument">
					<!-- will be filled in from article.js -->
				</div>
			</div>
			<div class="span10">
				<b>Letter</b>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Year</i>
				</div>
				<div class="span6">
					<xsl:value-of select="datum_jaar" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Text type</i>
				</div>
				<div class="span6">
					<xsl:value-of select="type_brief" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Autograph</i>
				</div>
				<div class="span6">
					<xsl:value-of select="autograaf" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Signature</i>
				</div>
				<div class="span6">
					<xsl:value-of select="signatuur" />
				</div>
			</div>
			<div class="span10">
				<b>Sender</b>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Name</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_naam_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Gender</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_geslacht" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Class</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_klasse" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Age</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_geb_lftcat" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Region of residence</i>
				</div>
				<div class="span6">
					<xsl:value-of select="regiocode" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Relationship to addressee</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_rel_tot_adr" />
				</div>
			</div>
			<div class="span10">
				<b>Addressee</b>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Name</i>
				</div>
				<div class="span6">
					<xsl:value-of select="adr_naam_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Place</i>
				</div>
				<div class="span6">
					<xsl:value-of select="adr_loc_plaats_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Country</i>
				</div>
				<div class="span6">
					<xsl:value-of select="adr_loc_land_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Region</i>
				</div>
				<div class="span6">
					<xsl:value-of select="adr_loc_regio_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Ship</i>
				</div>
				<div class="span6">
					<xsl:value-of select="adr_loc_schip_norm" />
				</div>
			</div>
			<div class="span10">
				<b>Sent from</b>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Place</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_loc_plaats_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Country</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_loc_land_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Region</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_loc_regio_norm" />
				</div>
			</div>
			<div class="span10">
				<div class="span2">
					<i>Ship</i>
				</div>
				<div class="span6">
					<xsl:value-of select="afz_loc_schip_norm" />
				</div>
			</div>
		</div>
	</xsl:template>
	
</xsl:stylesheet>
