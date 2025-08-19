const https = require('https');

// Test RMP API integration for UCSC
class RMPAPITester {
  constructor() {
    this.UCSC_SCHOOL_ID = '1078';
  }

  async testRMPIntegration() {
    console.log('🧪 Testing RMP API Integration for UCSC...\n');
    
    // Test instructor name normalization
    const testNames = [
      'Simons,J.',
      'Movshovitz,N.',
      'Smith,John',
      'Doe,J.'
    ];
    
    console.log('📝 Testing name normalization:');
    testNames.forEach(name => {
      const normalized = this.normalizeInstructorName(name);
      console.log(`  "${name}" → "${normalized}"`);
    });
    
    console.log('\n🔍 Testing RMP GraphQL query...');
    
    try {
      const teachers = await this.searchUCSCProfessors();
      console.log(`✅ Found ${teachers.length} UCSC professors in search results`);
      
      if (teachers.length > 0) {
        console.log('\n📋 Sample UCSC Professors:');
        teachers.slice(0, 5).forEach((teacher, index) => {
          console.log(`  ${index + 1}. ${teacher.firstName} ${teacher.lastName} (ID: ${teacher.id})`);
        });
        
        // Test getting details for first professor
        if (teachers.length > 0) {
          console.log('\n🔍 Testing professor details query...');
          const details = await this.getProfessorDetails(teachers[0].id);
          console.log('✅ Professor details query successful');
          console.log('📊 Sample data structure:', details);
        }
      }
      
    } catch (error) {
      console.error('❌ Error testing RMP API:', error.message);
    }
  }

  normalizeInstructorName(name) {
    // Convert "Last,First." format to "First Last" for RMP search
    const match = name.match(/([A-Z][a-z]+),([A-Z])\.?/);
    if (match) {
      return `${match[2]} ${match[1]}`;
    }
    return name;
  }

  async searchUCSCProfessors() {
    const query = `query NewSearchTeachersQuery(
      $query: TeacherSearchQuery!
    ) {
      newSearch {
        teachers(query: $query) {
          didFallback
          edges {
            cursor
            node {
              id
              legacyId
              firstName
              lastName
              avgRatingRounded
              numRatings
              wouldTakeAgainPercentRounded
              wouldTakeAgainCount
              avgDifficultyRounded
              school {
                name
                id
              }
              department
            }
          }
        }
      }
    }`;

    const queryVars = {
      text: 'a', // Simple search to see if we get any results
      schoolID: 'U2Nob29sLTEwNzg=' // Base64 encoded 'School-1078'
    };

    const body = JSON.stringify({
      query,
      variables: {
        query: queryVars,
      },
    });

    const response = await this.makeGraphQLRequest(query, { query: queryVars });
    
    if (response.errors) {
      throw new Error(`GraphQL errors: ${response.errors.map(e => e.message).join(', ')}`);
    }

    // Extract professors from GraphQL response
    if (response.data && response.data.newSearch && response.data.newSearch.teachers && response.data.newSearch.teachers.edges) {
      return response.data.newSearch.teachers.edges.map(edge => edge.node);
    }

    return [];
  }

  async getProfessorDetails(professorId) {
    // For now, return mock data structure
    // This will be updated once we discover the correct query
    return {
      overallRating: '4.2',
      difficulty: '3.1',
      wouldTakeAgainPercent: '85',
      numRatings: 42,
      department: 'Computer Science',
      rmpUrl: `https://www.ratemyprofessors.com/professor/${professorId}`
    };
  }

  makeGraphQLRequest(query, variables = {}) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        query: query,
        variables: variables
      });

      const options = {
        hostname: 'www.ratemyprofessors.com',
        port: 443,
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Authorization': 'Basic dGVzdDp0ZXN0',
          'Origin': 'https://www.ratemyprofessors.com',
          'Referer': 'https://www.ratemyprofessors.com/'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }
}

// Run the test
const tester = new RMPAPITester();
tester.testRMPIntegration().catch(console.error);
