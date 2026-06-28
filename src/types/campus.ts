/**
 * UCSC Campus Directory (LDAP/AMP) profile. Every field arrives as a string or
 * an array of strings; consumers normalize via getFirst.
 */

export type CampusField = string | string[] | undefined;

export interface CampusProfile {
  /** Full / common name. */
  cn?: CampusField;
  ucscpersonpubdepartmentnumber?: CampusField;
  ucscpersonpubdivision?: CampusField;
  mail?: CampusField;
  telephonenumber?: CampusField;
  ucscpersonpubofficehours?: CampusField;
  ucscpersonpubresearchinterest?: CampusField;
  ucscpersonpubfacultycourses?: CampusField;
  jpegphoto?: CampusField;
  ucscpersonpubwebsite?: CampusField;
  ucscpersonpubselectedpublication?: CampusField;
  /** Other LDAP attributes may be present. */
  [key: string]: CampusField;
}

export interface CampusDirectoryResponse {
  data: CampusProfile | null;
  success: boolean;
}
